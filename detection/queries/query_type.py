from abc import abstractmethod
import json
import my_utils.utils as my_utils

class QueryType:
    def __init__(self, str_type):
        self.type = str_type

    def get_type(self):
        return self.type

    @abstractmethod
    def find_vulnerable_paths(self, session, vuln_paths):
        pass

    def get_obj_recon_queries(self, session, source):
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
                ref_edge.IdentifierName
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
                ref_edge.IdentifierName
        """
        return [recon_query, recon_logical_expr_query]

    def find_variable_declarators(self, session, param_name, obj_ids):
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

    def assign_type(self, session, param_name, obj_ids):
        var_decls = self.find_variable_declarators(session, param_name, list(obj_ids))
        for var in var_decls:
            # ======================== Number =========================
            num_bin_exp_query = f"""
                MATCH
                    (bin_exp:BinaryExpression)
                        -[:AST]
                            ->(id:Identifier),
                    (bin_exp)
                        -[:AST]
                            ->(literal:Literal)    
                WHERE
                    toInteger(literal.Raw) IS NOT NULL AND
                    id.IdentifierName = "{var}"
                RETURN true
            """
            results = session.run(num_bin_exp_query)
            if results.peek():
                return "number"
            # ======================== String =========================
            str_func_call_query = f"""
                MATCH
                    (call_or_new_exp)
                        -[arg:AST]
                            ->(id:Identifier)    
                WHERE
                    (call_or_new_exp:CallExpression OR call_or_new_exp:NewExpression) AND
                    arg.RelationType = "arg" AND
                    id.IdentifierName = "{var}"
                RETURN true
            """
            results = session.run(str_func_call_query)
            if results.peek():
                return "string"

            obj_func_call_query = f"""
                MATCH
                    (call_exp:CallExpression)
                        -[arg:AST]
                            ->(literal:Literal),    
                    (call_exp)
                        -[:AST]
                            ->(:MemberExpression)
                                -[object:AST]
                                    ->(id:Identifier)
                WHERE
                    arg.RelationType = "arg" AND
                    toString(literal.Raw) = literal.Raw AND
                    object.RelationType = "object" AND
                    id.IdentifierName = "{var}"
                RETURN true
            """
            results = session.run(obj_func_call_query)
            if results.peek():
                return "string"

            str_bin_exp_query = f"""
                MATCH
                    (bin_exp:BinaryExpression)
                        -[:AST]
                            ->(id:Identifier),
                    (bin_exp)
                        -[:AST]
                            ->(literal:Literal)    
                WHERE
                    toString(literal.Raw) = literal.Raw AND
                    id.IdentifierName = "{var}"
                RETURN true
            """
            results = session.run(str_bin_exp_query)
            if results.peek():
                return "string"
            # ===================== Prop String =======================
			# This pattern is present when a parameter is a property, type can be any or prop_string
            # prop_str_query = f"""
            #     MATCH
            #         (:MemberExpression)
            #             -[property:AST]
            #                 ->(id:Identifier)
            #     WHERE
            #         property.RelationType = "property" AND
            #         id.IdentifierName = "{var}"
            #     RETURN true
            # """
            # results = session.run(prop_str_query)
            # if results.peek():
            #     return "prop_string" #TODO
            # ========================= Bool ==========================
            # ======================= Function ========================
            func_func_call_query = f"""
                MATCH
                    (:CallExpression)
                        -[callee:AST]
                            ->(id:Identifier)    
                WHERE
                    callee.RelationType = "callee" AND
                    id.IdentifierName = "{var}"
                RETURN true
            """
            results = session.run(func_func_call_query)
            if results.peek():
                return "any" #TODO

        
        return "any"
    
    def object_to_array(self, params_types):
        for i, v in params_types.items():
            if isinstance(v, dict) and "length" in params_types[i].keys() and all(key.isdigit() or key == "length" or key == "*" for key in params_types[i].keys()):
                arr = []
                for key, value in params_types[i].items():
                    if key.isdigit() and (index := int(key)) > len(arr):
                        arr.extend(["any"] * (index - len(arr)))
                    if key.isdigit():
                        arr.insert(int(key), value)
                params_types[i] = arr
            elif isinstance(v, dict):
                self.object_to_array(params_types[i])
    
    def assign_types(self, session, d):
        if isinstance(d, dict):
            for i, v in d.items():
                if isinstance(v, dict) and len(v) == 1:
                    d[i] = self.assign_type(session, i, d[i]["pdg_node_id"])
                # elif all(key.isdigit() or key == "length" or key == "pdg_node_id" for key in d[i].keys()):
                #     arr = []
                #     for key, value in d[i].items():
                #         if key.isdigit() and int(key) > len(arr):
                #             arr.extend(["any"] * (int(key) - len(arr)))
                #         elif key.isdigit():
                #             arr.insert(int(key), value)
                #     d[i] = arr
                else:
                    d[i].pop("pdg_node_id", None)
                    self.assign_types(session, d[i])

    def reconstruct_attacker_controlled_data(self, session, source):
        """
        Find and reconstruct the parameters controlled by an attacker.
        """
        params_types = {}
        queries = self.get_obj_recon_queries(session, source)
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
            
        self.assign_types(session, params_types)
        self.object_to_array(params_types)

        return list(params_types.keys()), params_types
    
