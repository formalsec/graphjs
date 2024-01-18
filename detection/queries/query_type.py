from abc import abstractmethod
import os
import my_utils.utils as my_utils

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


def get_obj_recon_queries(source):
    recon_query = f"""
        MATCH
            obj_recon_path=
                (source)
                    -[ref_edge:REF]
                        ->(param:PDG_OBJECT)
                            -[obj_edges:PDG*0..]
                                ->(obj_or_sink)
        WHERE 
            source.Id = "{source}" AND
            ref_edge.RelationType = "param" AND
            (obj_or_sink:PDG_OBJECT OR obj_or_sink:TAINT_SINK)
        RETURN *
        ORDER BY 
            ref_edge.ParamIndex
    """
    recon_logical_expr_query = f"""
        MATCH
            obj_recon_path=
                (source)
                    -[ref_edge:REF]
                        ->(param:PDG_OBJECT)
                            -[dep_arg_edges:PDG*1..2]
                                ->(new_obj:PDG_OBJECT)
                                    -[obj_edges:PDG*1..]
                                        ->(:PDG_OBJECT),
            (new_obj)
                <-[:REF]
                    -(:ExpressionStatement)
                        -[expression:AST]
                            ->(:AssignmentExpression)
                                -[right:AST]
                                    ->(:LogicalExpression)
        WHERE 
            source.Id = "{source}" AND
            ref_edge.RelationType = "param" AND
            (
                (size(dep_arg_edges) = 2 AND dep_arg_edges[0].RelationType = "ARG" AND dep_arg_edges[1].RelationType = "DEP") OR
                (size(dep_arg_edges) = 1 AND dep_arg_edges[0].RelationType = "DEP") 
            ) 
        RETURN *
        ORDER BY 
            ref_edge.ParamIndex
    """
    return [recon_query, recon_logical_expr_query]


def assign_types(session, d, config):
    """
    Traverse the attacker-controlled data and assign a JavaScript type to each parameter.
    """
    if isinstance(d, dict):
        for i, v in d.items():
            if isinstance(v, dict) and len(v) == 1:
                d[i] = assign_type(session, i, d[i]["pdg_node_id"], config)
            else:
                d[i].pop("pdg_node_id", None)
                assign_types(session, d[i], config)


def assign_type(session, param_name, obj_ids, config):
    """
    Assign a JavaScript type to the attacker-controlled parameter param_name.
    """
    var_decls = find_variable_declarators(session, param_name, list(obj_ids))
    sinks = my_utils.get_sinks_from_config(config)
    prototypes = config["prototypes"]
    functions_signatures = config["functions-signatures"]
    types = set()
    # ============================ Several Types ===============================
    # Array, Number, Object: Static Methdos, e.g. Array.isArray(param)
    arr_static_methods_query = f"""
        MATCH
            (call_exp:CallExpression)
                -[:AST]
                    ->(mem_exp:MemberExpression)
                        -[object:AST]
                            ->(type:Identifier),
            (call_exp)
                -[arg:AST]
                    ->(id:Identifier)
        WHERE
            object.RelationType = "object" AND
            type.IdentifierName in ["Array", "Number", "Object"] AND
            arg.RelationType = "arg" AND
            id.IdentifierName in {var_decls}
        RETURN type.IdentifierName
    """
    results = session.run(arr_static_methods_query)
    for result in results:
        types.add(result["type.IdentifierName"].lower())
    # Array, Boolean, Function, Number, Object, String: Node.js Built-in Functions, e.g. path.join(arr)
    any_built_in_functions_query = f"""
        MATCH
            (call_exp:CallExpression)
                -[:AST]
                    ->(function:Identifier),
            (call_exp)
                -[arg:AST]
                    ->(id:Identifier)
        WHERE
            function.IdentifierName in {list(functions_signatures.keys())} AND
            arg.RelationType = "arg" AND
            id.IdentifierName in {var_decls}
        RETURN function.IdentifierName, arg
    """
    results = session.run(any_built_in_functions_query)
    for result in results:
        function = functions_signatures[result["function.IdentifierName"]]
        args_types = function["args_types"]
        arg = int(result["arg"]["ArgumentIndex"])
        if len(args_types) >= arg:
            types.add(args_types[arg - 1])
        elif arg > len(args_types) and "rest?" in function:
            types.add(args_types[0])
    # Array, Boolean, Function, Number, Object, String: typeof keyword, e.g. typeof param === "function"
    any_typeof_query = f"""
        MATCH
            (var_decl:VariableDeclarator)
                -[:AST]
                    ->(una_exp:UnaryExpression)
                        -[:AST]
                            ->(id:Identifier),
            (bin_exp:BinaryExpression)
                -[right:AST]
                    ->(literal:Literal),
            (bin_exp)
                -[left:AST]
                    ->(var:Identifier)
        WHERE
            una_exp.SubType = "typeof" AND
            id.IdentifierName in {var_decls} AND
            bin_exp.SubType in ["==", "==="] AND
            right.RelationType = "right" AND
            left.RelationType = "left" AND
            var_decl.IdentifierName = var.IdentifierName
        RETURN literal.Raw
    """
    results = session.run(any_typeof_query)
    for result in results:
        types.add(result["literal.Raw"].replace("'", ""))
    # ================================= Function ================================
    # Function (Any): Function call, e.g. param()
    if "function" not in types:
        func_func_call_query = f"""
            MATCH
                (:CallExpression)
                    -[callee:AST]
                        ->(id:Identifier)    
            WHERE
                callee.RelationType = "callee" AND
                 id.IdentifierName  = "{var_decls[0]}" 
            RETURN true
        """
        results = session.run(func_func_call_query)
        if results.peek():
            return "function"
    # ================================== Array ==================================
    # Array: Prototype function call, e.g. param.join('')
    if "array" not in types:
        arr_proto_func_call_query = f"""
            MATCH
                (:CallExpression)
                    -[:AST]
                        ->(mem_exp:MemberExpression)
                            -[object:AST]
                                ->(id:Identifier),
                (mem_exp)
                    -[property:AST]
                        ->(proto_func:Identifier)
            WHERE
                object.RelationType = "object" AND
                id.IdentifierName in {var_decls} AND
                property.RelationType = "property" AND
                proto_func.IdentifierName in {prototypes["array"]}
            RETURN true
        """
        results = session.run(arr_proto_func_call_query)
        if results.peek():
            types.add("array")
    # Array: ForOfStatement, e.g. for i of param
    if "array" not in types:
        arr_proto_func_call_query = f"""
            MATCH
                (:ForOfStatement)
                    -[right:AST]
                        ->(id:Identifier)    
            WHERE
                right.RelationType = "right" AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(arr_proto_func_call_query)
        if results.peek():
            types.add("array")
    # ================================ Boolean ================================
    # Boolean: Binary Expression, e.g. param === true
    if "bool" not in types:
        bool_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                bin_exp.SubType in ["==", "==="] AND
                literal.SubType = "boolean" AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(bool_bin_exp_query)
        if results.peek():
            types.add("bool")
    # ================================= Number ==================================
    # Number: Binary Expression, e.g. param + 4
    if "number" not in types:
        num_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                literal.SubType = "number" AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(num_bin_exp_query)
        if results.peek():
            types.add("number")
    # Number: Binary Expression with number operators, e.g. param / num
    if "number" not in types:
        num_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier)
            WHERE
                bin_exp.SubType in ["*", "-", "/", "**", "%", ">", "<", ">=", "<="] AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(num_bin_exp_query)
        if results.peek():
            types.add("number")
    # ================================= String ==================================
    # String: Prototype function call, e.g. param.charAt(0)
    if "string" not in types:
        str_proto_func_call_query = f"""
            MATCH
                (:CallExpression)
                    -[:AST]
                        ->(mem_exp:MemberExpression)
                            -[object:AST]
                                ->(id:Identifier),
                (mem_exp)
                    -[property:AST]
                        ->(proto_func:Identifier)
            WHERE
                object.RelationType = "object" AND
                id.IdentifierName = "{var_decls[0]}" AND
                property.RelationType = "property" AND
                proto_func.IdentifierName in {prototypes["string"]}
            RETURN true
        """
        results = session.run(str_proto_func_call_query)
        if results.peek():
            types.add("string")
    # String: Binary Expression concatenation, e.g. param + "string"
    if "string" not in types:
        str_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                bin_exp.SubType in ["+", "=="] AND
                literal.SubType = "string" AND
                id.IdentifierName in {var_decls} 
            RETURN true
        """
        results = session.run(str_bin_exp_query)
        if results.peek():
            types.add("string")
    # String: Template Literal, e.g. `This is a string ${param}`
    if "string" not in types:
        str_tmplt_literal_query = f"""
            MATCH
                (:TemplateLiteral)
                    -[:AST]
                        ->(id:Identifier)
            WHERE
                id.IdentifierName = "{var_decls[0]}"
            RETURN true
        """
        results = session.run(str_tmplt_literal_query)
        if results.peek():
            # print("# String: Template Literal, e.g. `This is a string $param`")
            types.add("string")
    # String: Function call argument, e.g. eval(param)
    if "string" not in types:
        str_func_call_query = f"""
            MATCH
                (call_or_new_exp)
                    -[arg:AST]
                        ->(id:Identifier),
                (call_or_new_exp)
                    -[callee:AST]
                        ->(sink:Identifier)
            WHERE
                (call_or_new_exp:CallExpression OR call_or_new_exp:NewExpression) AND
                arg.RelationType = "arg" AND
                arg.ArgumentIndex = "1" AND
                id.IdentifierName in {var_decls} AND
                callee.RelationType = "callee" AND
                sink.IdentifierName in {sinks}
            RETURN true
        """
        results = session.run(str_func_call_query)
        if results.peek():
            types.add("string")
    # String: Member expression function call argument, e.g. child_process.exec(param)
    if "string" not in types:
        str_mem_exp_func_call_query = f"""
            MATCH
                (call_exp:CallExpression)
                    -[arg:AST]
                        ->(id:Identifier),    
                (call_exp)
                    -[callee:AST]
                        ->(:MemberExpression)
                            -[property:AST]
                                ->(sink:Identifier)
            WHERE
                arg.RelationType = "arg" AND
                arg.ArgumentIndex = "1" AND
                id.IdentifierName in {var_decls} AND
                callee.RelationType = "callee" AND
                property.RelationType = "property" AND
                sink.IdentifierName in {sinks}
            RETURN true
        """
        results = session.run(str_mem_exp_func_call_query)
        if results.peek():
            types.add("string")
    # String: Member Expression Computed property, e.g. obj[param]
    if "string" not in types:
        prop_str_query = f"""
            MATCH
                (mem_exp:MemberExpression)
                    -[property:AST]
                        ->(id:Identifier)
            WHERE
                mem_exp.SubType = "computed" AND
                property.RelationType = "property" AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(prop_str_query)
        if results.peek():
            types.add("string")

    types = list(types)
    types.sort()
    return { "_union": types} if len(types) else "any"


def find_variable_declarators(session, param_name, obj_ids):
    """
    Find variable declarators in the graph that depend on param_name
    """
    find_var_decls_query = f"""
        MATCH
            (vx:VariableDeclarator)
                -[:REF]
                    ->(obj:PDG_OBJECT)
        WHERE
            obj.Id in {obj_ids}
        RETURN vx 
    """

    results = session.run(find_var_decls_query)
    var_decls = [param_name]
    for record in results:
        # destructuring is also a variable declarator
        if record["vx"]["IdentifierName"]:
            var_decls.append(record["vx"]["IdentifierName"])

    return var_decls


def is_lazy_object(self, obj):
    """
    Check if object is lazy-object, e.g, {"*": {"*": "any" } }
    """
    if not isinstance(obj, dict):
        return False

    for key in obj.keys():
        if key != "*":
            return False

        value = obj[key]
        if isinstance(value, dict):
            if not self.is_lazy_object(value):
                return False
        elif value != "any":
            return False

    return True


def simplify_objects(self, params_types, config, polluted_object=False, polluting_value=False):
    """
    1 - Some objects might be arrays.
    2 - Some objects don't contain useful information (lazy-objects), e.g, {"*": {"*": "any"}}
    """
    polluted_object_name = polluted_object["IdentifierName"].split(".")[1].split("-")[
        0] if polluted_object else polluted_object
    polluting_value_name = polluting_value["IdentifierName"].split(".")[1].split("-")[
        0] if polluting_value else polluting_value
    for i, v in params_types.items():
        if isinstance(v, dict) and any(key.isdigit() for key in params_types[i].keys()):
            arr = []
            for key, value in params_types[i].items():
                if key.isdigit():
                    arr.extend(["any"] * (int(key) - len(arr)))
                    arr.insert(int(key), value)
            if all(key == "length" or key.isdigit() or key == "*" for key in params_types[i].keys()):
                params_types[i] = arr
            else:
                params_types[i] = f"{params_types[i]} | {arr}"
        elif isinstance(v, dict) and "length" in params_types[i] and all(
                key == "length" or key == "*" or key in config["prototypes"]["string"] for key in
                params_types[i].keys()):
            params_types[i] = f"{params_types[i]} | array | string"
        elif isinstance(v, dict) and ("length" in params_types[i] and all(
                key == "length" or key == "*" for key in params_types[i].keys())):
            params_types[i] = f"{params_types[i]} | array"
        elif self.is_lazy_object(params_types[i]) and polluted_object_name == i:
            params_types[i] = f"polluted-object | array"
        elif self.is_lazy_object(params_types[i]) and polluting_value_name == i:
            params_types[i] = f"polluting-object | array"
        elif self.is_lazy_object(params_types[i]):
            params_types[i] = f"lazy-object | array"
        elif isinstance(v, dict):
            self.simplify_objects(params_types[i], config)


class QueryType:
    debug = False  # TODO: Delete

    def __init__(self, str_type):
        self.type = str_type

    def get_type(self):
        return self.type

    @abstractmethod
    def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, detection_output, config):
        pass
