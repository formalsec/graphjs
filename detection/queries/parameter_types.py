from .my_utils import utils as my_utils
from typing import Dict

from .query import DetectionResult


# Cypher Queries
def get_parameter_dependent_objects(fn_id) -> str:
    return f"""
        MATCH
            obj_recon_path=
                (source)
                    -[ref_edge:REF]
                        ->(param:PDG_OBJECT)
                            -[obj_edges:PDG*0..]
                                ->(obj_or_sink)
        WHERE 
            source.Id = "{fn_id}" AND
            ref_edge.RelationType = "param" AND
            (obj_or_sink:PDG_OBJECT OR obj_or_sink:TAINT_SINK)
        RETURN *
        ORDER BY 
            ref_edge.ParamIndex

    """


def get_parameter_expression_objects(fn_id) -> str:
    return f"""
        MATCH
            obj_recon_path=
                ({{Id: "{fn_id}"}})
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
            ref_edge.RelationType = "param" AND
            (
                (size(dep_arg_edges) = 2 AND dep_arg_edges[0].RelationType = "ARG" AND dep_arg_edges[1].RelationType = "DEP") OR
                (size(dep_arg_edges) = 1 AND dep_arg_edges[0].RelationType = "DEP") 
            ) 
        RETURN *
        ORDER BY 
            ref_edge.ParamIndex
    """


def get_parameter_name(full_name: str) -> str:
    if "argv" not in full_name:
        return full_name.split(".")[1].split("-")[0]
    else:
        return "argv"


# Find variable declarators in the graph that depend on param_name
def get_variable_declarators(obj_ids: list[int]) -> str:
    return f"""
        MATCH
            (vx:VariableDeclarator)
                -[:REF]
                    ->(obj:PDG_OBJECT)
        WHERE
            obj.Id in {obj_ids}
        RETURN DISTINCT vx.IdentifierName as id
    """


# This function is responsible for reconstructing the parameter types.
# First, it reconstructs the object's structure and then assigns the types
def reconstruct_param_types(session, function_cfg_id, detection_result: DetectionResult, config):
    # Params_types stores
    params_types: Dict[str, Dict[str, dict | set]] = {}

    dependent_objects = session.run(get_parameter_dependent_objects(function_cfg_id))
    expression_dependent_objects = session.run(get_parameter_expression_objects(function_cfg_id))

    # This loops reconstructs the objects' structure
    for obj_type in [dependent_objects, expression_dependent_objects]:
        for param_obj in obj_type:

            # Get parameter name
            parameter_name = get_parameter_name(param_obj["param"]["IdentifierName"])
            if parameter_name == "this":
                continue

            obj_recon_flag = True

            # If parameter name is not in the map, simply add it
            if parameter_name not in params_types:
                params_types[parameter_name] = {"pdg_node_id": {param_obj["param"]["Id"]}}
            # If the parameter is in the map, check if it has properties
            else:
                parent_param_types = params_types
                params_types = params_types[parameter_name]

                for edge in param_obj["obj_edges"]:
                    sub_node_id = edge.nodes[1]["Id"]
                    if edge["RelationType"] == "SO" and obj_recon_flag:
                        prop_name = edge["IdentifierName"]
                        if prop_name not in params_types:
                            params_types[prop_name] = {
                                "pdg_node_id": {sub_node_id}
                            }
                        else:
                            params_types[prop_name]["pdg_node_id"].add(sub_node_id)
                        params_types = params_types[prop_name]
                    elif edge["RelationType"] == "DEP":
                        obj_recon_flag = False
                        params_types["pdg_node_id"].add(sub_node_id)
                params_types = parent_param_types

    print(f'[INFO] Assigning types to attacker-controlled data.')
    assign_types(session, params_types, config)
    simplify_objects(params_types,
                     config,
                     detection_result.get('polluted_obj', False),
                     detection_result.get('polluting_value', False))

    return list(params_types.keys()), params_types


# This function traverses the parameters and assign a JavaScript type to each parameter.
# It is recursive until it finds a single value
def assign_types(session, param_structure, config):
    if isinstance(param_structure, dict):
        for key, value in param_structure.items():
            if isinstance(value, dict) and len(value) == 1:
                param_structure[key] = assign_type(session, key, list(param_structure[key]["pdg_node_id"]), config)
            else:
                param_structure[key].pop("pdg_node_id", None)
                assign_types(session, param_structure[key], config)


def is_lazy_object(obj):
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
            if not is_lazy_object(value):
                return False
        elif value != "any":
            return False

    return True


def simplify_objects(params_types, config, polluted_object=False, polluting_value=False):
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
                params_types[i] = {'_union': [params_types[i], arr] }
        elif isinstance(v, dict) and "length" in params_types[i] and all(
                key == "length" or key == "*" or key in config["prototypes"]["string"] for key in
                params_types[i].keys()):
            params_types[i] = {'_union': [params_types[i], "array", "string"]}
        elif isinstance(v, dict) and ("length" in params_types[i] and all(
                key == "length" or key == "*" for key in params_types[i].keys())):
            params_types[i] = {'_union': [params_types[i], "array"]}
        elif is_lazy_object(params_types[i]) and polluted_object_name == i:
            params_types[i] = f"object"
        elif is_lazy_object(params_types[i]) and polluting_value_name == i:
            params_types[i] = f"polluted-object"
        elif is_lazy_object(params_types[i]):
            params_types[i] = {'_union': [params_types[i], "array"]}
        elif isinstance(v, dict):
            simplify_objects(params_types[i], config)


# This function assigns a type to a parameter object (that may be represented by several objects)
def assign_type(session, param_name: str, obj_ids: list[int], config):
    variable_declarations = [r["id"] for r in session.run(get_variable_declarators(obj_ids))]
    variable_declarations.insert(0, param_name)
    if len(variable_declarations) > 0 and variable_declarations[0] is None:
        return "any"
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
            id.IdentifierName in {variable_declarations}
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
            id.IdentifierName in {variable_declarations}
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
            id.IdentifierName in {variable_declarations} AND
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
                 id.IdentifierName  = "{variable_declarations[0]}" 
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
                id.IdentifierName in {variable_declarations} AND
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
                id.IdentifierName in {variable_declarations}
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
                id.IdentifierName in {variable_declarations}
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
                id.IdentifierName in {variable_declarations}
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
                id.IdentifierName in {variable_declarations}
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
                id.IdentifierName = "{variable_declarations[0]}" AND
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
                id.IdentifierName in {variable_declarations} 
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
                id.IdentifierName = "{variable_declarations[0]}"
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
                id.IdentifierName in {variable_declarations} AND
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
                id.IdentifierName in {variable_declarations} AND
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
                id.IdentifierName in {variable_declarations}
            RETURN true
        """
        results = session.run(prop_str_query)
        if results.peek():
            types.add("string")

    types = list(types)
    types.sort()
    return {"_union": types} if len(types) > 1 else types[0] if len(types) == 1 else "any"
