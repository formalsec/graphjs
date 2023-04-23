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

    def reconstruct_attacker_controlled_data(self, session, source):
        """
        Find and reconstruct the parameters controlled by an attacker.
        """
        params_types = {}
        queries = self.get_queries(session, source)
        for query in queries:
            results = session.run(query)
            for record in results:
                param_name = record["param"]["IdentifierName"]
                if "argv" not in param_name:
                    param_name = param_name.split(".")[1].split("-")[0]
                else:
                    param_name = "argv"

                if param_name not in params_types:
                    params_types[param_name] = {}
                else:
                    param_types_pointer = params_types
                    params_types = params_types[param_name]
                    for rel in record["obj_edges"]:
                        # TODO: little trick
                        if rel["RelationType"] == "NV" or rel["RelationType"] == "ARG" or rel["RelationType"] == "DEP":
                            continue
                        prop_name = rel["IdentifierName"]
                        if not prop_name in params_types:
                            params_types[prop_name] = {}
                        params_types = params_types[prop_name]
                    params_types = param_types_pointer
            
        my_utils.change_dict_value_recursively(params_types, "any")

        return list(params_types.keys()), params_types
    
    def get_queries(self, session, source):
        recon_query = f"""
            MATCH
                (source)
                    -[ref_edge:REF]
                        ->(param:PDG_OBJECT)
                            -[obj_edges:PDG*0..]
                                ->(:PDG_OBJECT)
            WHERE 
                source.Id = "{source}" AND
                ref_edge.RelationType = "param" AND
                all(edge IN obj_edges WHERE edge.RelationType = "SO" or edge.RelationType = "NV" or edge.RelationType = "ARG")
            RETURN *
            ORDER BY 
                ref_edge.IdentifierName
        """
        recon_logical_expr_query = f"""
            MATCH
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
                ) AND
                all(edge IN obj_edges WHERE edge.RelationType = "SO" or edge.RelationType = "NV" or edge.RelationType = "ARG")
            RETURN *
            ORDER BY 
                ref_edge.IdentifierName
        """
        return [recon_query, recon_logical_expr_query]