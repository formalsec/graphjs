from abc import abstractmethod
import json
import my_utils.utils as my_utils

class QueryType:
    def __init__(self, str_type):
        self.type = str_type

    def get_type(self):
        return self.type

    @abstractmethod
    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, config):
        pass
    
    def get_obj_recon_queries(self, source):
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

    def find_variable_declarators(self, session, param_name, obj_ids):
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
        var_decls = [ param_name ]
        for record in results:
            var_decls.append(record["vx"]["IdentifierName"])

        return var_decls

    def assign_type(self, session, param_name, obj_ids, config):
        """
        Assign a JavaScript type to the attacker-controlled parameter param_name.
        """
        var_decls = self.find_variable_declarators(session, param_name, list(obj_ids))
        sinks = my_utils.get_sinks_from_config(config)
        prototypes = config["prototypes"]
        types = set()
        # ================================= Function ================================
        # Function (Any): Function call, e.g. param()
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
            return "any" #TODO: Any or function?
        # ================================== Array ==================================
        # Array: Prototype function call, e.g. param.join('')
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
                id.IdentifierName = "{var_decls[0]}" AND
                property.RelationType = "property" AND
                proto_func.IdentifierName in {prototypes["array"]}
            RETURN true
        """
        results = session.run(arr_proto_func_call_query)
        if results.peek():
            types.add("array")
        # Array: ForOfStatement, e.g. for i of param
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
        bool_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                (literal.Raw = "false" OR literal.Raw = "true") AND
                //(bin_exp.Sign = "==" OR bin_exp.Sign = "===") AND
                //literal.Type = "boolean" AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(bool_bin_exp_query)
        if results.peek():
            types.add("bool")
        # Bool: Logical Expression, e.g. param || param2
        # bool_log_exp_query = f"""
        #     MATCH
        #         (:LogicalExpression)
        #             -[:AST]
        #                 ->(id:Identifier)
        #     WHERE
        #         id.IdentifierName in {var_decls}
        #     RETURN true
        # """
        # results = session.run(bool_log_exp_query)
        # if results.peek():
        #     return "bool"
        # return "any"
        # ================================= Number ==================================
        # Number: Binary Expression, e.g. param + 4
        num_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                //bin_exp.Sign = "+" AND
                //literal.Type = "number" AND
                toInteger(literal.Raw) IS NOT NULL AND
                id.IdentifierName in {var_decls}
            RETURN true
        """
        results = session.run(num_bin_exp_query)
        if results.peek():
            types.add("number")
            # return "number"
        # ================================= String ==================================
        # String: Prototype function call, e.g. param.charAt(0)
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
                id.IdentifierName in {var_decls} AND
                property.RelationType = "property" AND
                proto_func.IdentifierName in {prototypes["string"]}
            RETURN true
        """
        results = session.run(str_proto_func_call_query)
        if results.peek():
            # print("# String: Prototype function call, e.g. param.charAt(0)")
            types.add("string")
        # String: Binary Expression concatenation, e.g. param + "string"
        str_bin_exp_query = f"""
            MATCH
                (bin_exp:BinaryExpression)
                    -[:AST]
                        ->(id:Identifier),
                (bin_exp)
                    -[:AST]
                        ->(literal:Literal)    
            WHERE
                //bin_exp.Sign in ["+", "==", "==="] AND
                //literal.Type = "string" AND
                toString(literal.Raw) = literal.Raw AND
                id.IdentifierName in {var_decls} 
            RETURN true
        """
        results = session.run(str_bin_exp_query)
        if results.peek():
            # print("# String: Binary Expression, e.g. param + string")
            types.add("string")
        # String: Template Literal, e.g. `This is a string ${param}`
        str_tmplt_literal_query = f"""
            MATCH
                (:TemplateLiteral)
                    -[:AST]
                        ->(id:Identifier)
            WHERE
                id.IdentifierName in {var_decls} 
            RETURN true
        """
        results = session.run(str_tmplt_literal_query)
        if results.peek():
            # print("# String: Template Literal, e.g. `This is a string $param`")
            types.add("string")
        # String: Function call argument, e.g. eval(param)
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
            # print("# String: Function call argument, e.g. eval(param)")
            types.add("string")
        # String: Member expression function call argument, e.g. child_process.exec(param)
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
            # print("# String: Member expression function call argument, e.g. child_process.exec(param)")
            types.add("string")
        # String: Member Expression property, e.g. obj[param] TODO: This query can lead to wrong typing obj[param] != obj.param
        # prop_str_query = f"""
        #     MATCH
        #         (:MemberExpression)
        #             -[property:AST]
        #                 ->(id:Identifier)
        #     WHERE
        #         property.RelationType = "property" AND
        #         id.IdentifierName in {var_decls}
        #     RETURN true
        # """
        # results = session.run(prop_str_query)
        # if results.peek():
        #     return "string"
        types = list(types)
        types.sort()
        return " | ".join(types) if len(types) else "any"

        # # Function (Any): Function call, e.g. param()
        # func_func_call_query = f"""
        #     MATCH
        #         (:CallExpression)
        #             -[callee:AST]
        #                 ->(id:Identifier)    
        #     WHERE
        #         callee.RelationType = "callee" AND
        #         id.IdentifierName  = "{var_decls[0]}" 
        #     RETURN true
        # """
        # results = session.run(func_func_call_query)
        # if results.peek():
        #     return "any" #TODO
        # # String: Prototype function call, e.g. param.charAt(0)
        # str_proto_func_call_query = f"""
        #     MATCH
        #         (:CallExpression)
        #             -[:AST]
        #                 ->(mem_exp:MemberExpression)
        #                     -[object:AST]
        #                         ->(id:Identifier),
        #         (mem_exp)
        #             -[property:AST]
        #                 ->(proto_func:Identifier)
        #     WHERE
        #         object.RelationType = "object" AND
        #         id.IdentifierName in {var_decls} AND
        #         property.RelationType = "property" AND
        #         proto_func.IdentifierName in {prototypes["string"]}
        #     RETURN true
        # """
        # results = session.run(str_proto_func_call_query)
        # if results.peek():
        #     # print("# String: Prototype function call, e.g. param.charAt(0)")
        #     types.add("string")
        #     # return "string"
        # # Number: Binary Expression, e.g. param + 4
        # num_bin_exp_query = f"""
        #     MATCH
        #         (bin_exp:BinaryExpression)
        #             -[:AST]
        #                 ->(id:Identifier),
        #         (bin_exp)
        #             -[:AST]
        #                 ->(literal:Literal)    
        #     WHERE
        #         toInteger(literal.Raw) IS NOT NULL AND
        #         id.IdentifierName in {var_decls}
        #     RETURN true
        # """
        # results = session.run(num_bin_exp_query)
        # if results.peek():
        #     types.add("number")
        #     # return "number"
        # # String: Binary Expression concatenation, e.g. param + "string"
        # str_bin_exp_query = f"""
        #     MATCH
        #         (bin_exp:BinaryExpression)
        #             -[:AST]
        #                 ->(id:Identifier),
        #         (bin_exp)
        #             -[:AST]
        #                 ->(literal:Literal)    
        #     WHERE
        #         toString(literal.Raw) = literal.Raw AND
        #         id.IdentifierName in {var_decls} 
        #     RETURN true
        # """
        # results = session.run(str_bin_exp_query)
        # if results.peek():
        #     # print("# String: Binary Expression, e.g. param + string")
        #     types.add("string")
        #     # return "string"
        # # Array: Prototype function call, e.g. param.join('')
        # arr_proto_func_call_query = f"""
        #     MATCH
        #         (:CallExpression)
        #             -[:AST]
        #                 ->(mem_exp:MemberExpression)
        #                     -[object:AST]
        #                         ->(id:Identifier),
        #         (mem_exp)
        #             -[property:AST]
        #                 ->(proto_func:Identifier)
        #     WHERE
        #         object.RelationType = "object" AND
        #         id.IdentifierName in {var_decls} AND
        #         property.RelationType = "property" AND
        #         proto_func.IdentifierName in {prototypes["array"]}
        #     RETURN true
        # """
        # results = session.run(arr_proto_func_call_query)
        # if results.peek():
        #     types.add("[]")
        #     # return []
        # # Array: ForOfStatement, e.g. for i of param
        # arr_proto_func_call_query = f"""
        #     MATCH
        #         (:ForOfStatement)
        #             -[right:AST]
        #                 ->(id:Identifier)    
        #     WHERE
        #         right.RelationType = "right" AND
        #         id.IdentifierName in {var_decls} 
        #     RETURN true
        # """
        # results = session.run(arr_proto_func_call_query)
        # if results.peek():
        #     types.add("[]")
        #     # return []
        # # String: Template Literal, e.g. `This is a string ${param}`
        # str_tmplt_literal_query = f"""
        #     MATCH
        #         (:TemplateLiteral)
        #             -[:AST]
        #                 ->(id:Identifier)
        #     WHERE
        #         id.IdentifierName in {var_decls} 
        #     RETURN true
        # """
        # results = session.run(str_tmplt_literal_query)
        # if results.peek():
        #     # print("# String: Template Literal, e.g. `This is a string $param`")
        #     types.add("string")
        #     return "string"
        # # String: Function call argument, e.g. eval(param)
        # str_func_call_query = f"""
        #     MATCH
        #         (call_or_new_exp)
        #             -[arg:AST]
        #                 ->(id:Identifier),
        #         (call_or_new_exp)
        #             -[callee:AST]
        #                 ->(sink:Identifier)
        #     WHERE
        #         (call_or_new_exp:CallExpression OR call_or_new_exp:NewExpression) AND
        #         arg.RelationType = "arg" AND
        #         arg.ArgumentIndex = "1" AND
        #         id.IdentifierName in {var_decls} AND
        #         callee.RelationType = "callee" AND
        #         sink.IdentifierName in {sinks}
        #     RETURN true
        # """
        # results = session.run(str_func_call_query)
        # if results.peek():
        #     # print("# String: Function call argument, e.g. eval(param)")
        #     types.add("string")
        #     # return "string"
        # # String: Member expression function call argument, e.g. child_process.exec(param)
        # str_mem_exp_func_call_query = f"""
        #     MATCH
        #         (call_exp:CallExpression)
        #             -[arg:AST]
        #                 ->(id:Identifier),    
        #         (call_exp)
        #             -[callee:AST]
        #                 ->(:MemberExpression)
        #                     -[property:AST]
        #                         ->(sink:Identifier)
        #     WHERE
        #         arg.RelationType = "arg" AND
        #         arg.ArgumentIndex = "1" AND
        #         id.IdentifierName in {var_decls} AND
        #         callee.RelationType = "callee" AND
        #         property.RelationType = "property" AND
        #         sink.IdentifierName in {sinks}
        #     RETURN true
        # """
        # results = session.run(str_mem_exp_func_call_query)
        # if results.peek():
        #     # print("# String: Member expression function call argument, e.g. child_process.exec(param)")
        #     types.add("string")
        #     # return "string"
        # # String: Member Expression property, e.g. obj[param] TODO: This query can lead to wrong typing
        # # prop_str_query = f"""
        # #     MATCH
        # #         (:MemberExpression)
        # #             -[property:AST]
        # #                 ->(id:Identifier)
        # #     WHERE
        # #         property.RelationType = "property" AND
        # #         id.IdentifierName in {var_decls}
        # #     RETURN true
        # # """
        # # results = session.run(prop_str_query)
        # # if results.peek():
        # #     return "string"
        # # Bool: Binary Expression, e.g. param === true 
        # bool_bin_exp_query = f"""
        #     MATCH
        #         (bin_exp:BinaryExpression)
        #             -[:AST]
        #                 ->(id:Identifier),
        #         (bin_exp)
        #             -[:AST]
        #                 ->(literal:Literal)    
        #     WHERE
        #         (literal.Raw = "false" OR literal.Raw = "true") AND
        #         id.IdentifierName in {var_decls}
        #     RETURN true
        # """
        # results = session.run(bool_bin_exp_query)
        # if results.peek():
        #     types.add("bool")
        #     # return "bool"
        # # Bool: Logical Expression, e.g. param || param2
        # # bool_log_exp_query = f"""
        # #     MATCH
        # #         (:LogicalExpression)
        # #             -[:AST]
        # #                 ->(id:Identifier)
        # #     WHERE
        # #         id.IdentifierName in {var_decls}
        # #     RETURN true
        # # """
        # # results = session.run(bool_log_exp_query)
        # # if results.peek():
        # #     return "bool"
        # # return "any"
        # return " | ".join(list(types)) if len(types) else "any"
    
    
    def assign_types(self, session, d, config):
        """
        Traverse the attacker-controlled data and assign a JavaScript type to each parameter.
        """
        if isinstance(d, dict):
            for i, v in d.items():
                if isinstance(v, dict) and len(v) == 1:
                    d[i] = self.assign_type(session, i, d[i]["pdg_node_id"], config)
                else:
                    d[i].pop("pdg_node_id", None)
                    self.assign_types(session, d[i], config)

    def object_to_array(self, params_types):
        """
        Transform an object into its correct type: array.
        """
        for i, v in params_types.items():
            if isinstance(v, dict) and (("length" in params_types[i].keys() and  all(key.isdigit() or key == "length" or key == "*" for key in params_types[i].keys())) or (any(key.isdigit() for key in params_types[i].keys()) and all(key.isdigit() or key == "*" for key in params_types[i].keys()))):
                arr = []
                for key, value in params_types[i].items():
                    if key.isdigit(): 
                        arr.extend(["any"] * (int(key) - len(arr)))
                        arr.insert(int(key), value)
                    # elif key == "*":
                    #     arr.append(value)
                params_types[i] = arr if arr != [] else "array"
            elif isinstance(v, dict):
                self.object_to_array(params_types[i])
    
    def reconstruct_attacker_controlled_data(self, session, source, config):
        """
        Find and reconstruct the parameters controlled by an attacker.
        """
        params_types = {}
        queries = self.get_obj_recon_queries(source)
        for query in queries:
            results = session.run(query)
            for record in results:
                param = record["param"]
                param_name = param["IdentifierName"]
                if "argv" not in param_name:
                    param_name = param_name.split(".")[1].split("-")[0]
                else:
                    param_name = "argv"

                obj_recon_flag = True
                if param_name not in params_types:
                    params_types[param_name] = {
                        "pdg_node_id": set([ param["Id"] ])
                    }
                else:
                    param_types_pointer = params_types
                    params_types = params_types[param_name]
                    for rel in record["obj_edges"]:
                        if rel["RelationType"] == "SO" and obj_recon_flag:
                            prop_name = rel["IdentifierName"]
                            if prop_name not in params_types:
                                params_types[prop_name] = {
                                    "pdg_node_id": set([ rel.nodes[1]["Id"] ])
                                }
                            else:
                                params_types[prop_name]["pdg_node_id"].add(rel.nodes[1]["Id"])
                            params_types = params_types[prop_name]
                        elif rel["RelationType"] == "DEP":
                            obj_recon_flag = False
                            params_types["pdg_node_id"].add(rel.nodes[1]["Id"])
                    params_types = param_types_pointer
            
        self.assign_types(session, params_types, config)
        self.object_to_array(params_types)

        return list(params_types.keys()), params_types 