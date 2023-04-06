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
        query = f"""
            MATCH
                (source)
                    -[ref_edge:REF]
                        -(param:PDG_OBJECT)
                            -[obj_edges:PDG*0..]
                                ->(obj:PDG_OBJECT)
            WHERE 
                source.Id = "{source}" AND
                ref_edge.RelationType = "param" AND
                all(edge IN obj_edges WHERE edge.RelationType = "SO" or edge.RelationType = "NV" or edge.RelationType = "ARG")
            RETURN *
            ORDER BY 
                ref_edge.IdentifierName
        """

        results = session.run(query)

        params_types = {}
        for record in results:
            param_name = record["param"]["IdentifierName"].split(".")[1].split("-")[0]

            if param_name not in params_types:
                params_types[param_name] = {}
            else:
                param_types_pointer = params_types
                params_types = params_types[param_name]
                for rel in record["obj_edges"]:
                    # TODO: little trick
                    if rel["RelationType"] == "NV" or rel["RelationType"] == "ARG":
                        continue
                    prop_name = rel["IdentifierName"]
                    if not prop_name in params_types:
                        params_types[prop_name] = {}
                    params_types = params_types[prop_name]
                params_types = param_types_pointer
        
        my_utils.change_dict_value_recursively(params_types, "any")

        return list(params_types.keys()), params_types


    def get_function_calls_in_path(self, funcId, session):
        pass
        # calls = []
        # with session.begin_transaction() as tx:
        #     # QUERY 3
        #     # get (function, parameter) pairs that we consider source
        #     query = f"""
        #         MATCH
        #             (f1:FunctionExpression)-[:AST*1..]->(stmt)-[init1:AST]->(fCall:CallExpression)-[callee:AST]->(fName:Identifier),
        #             (v:VariableDeclarator)-[init2:AST]->(f2:FunctionExpression),
        #             (v)-[:FD]->(start:CFG_F_START),
        #             cfg_path=(start)-[:CFG*1..]->(end:CFG_F_END)
        #         WHERE
        #             f1.Id = '{funcId}' AND
        #             init1.RelationType = 'init' AND
        #             callee.RelationType = 'callee' AND
        #             v.IdentifierName = fName.IdentifierName
        #         RETURN *
        #     """
        #     results = tx.run(query)

        #     for record in results:
        #         calls.append({
        #             'funcId': record['f2'].get('Id'),
        #             'functionName': record['fName'].get('IdentifierName'),
        #             'stmt': record['stmt'],
        #             'cfg_path': record['cfg_path']
        #         })
        # return calls


    def find_vulnerable_lines(self, cfg_path):
        # result = {}
        # localCalls = self.get_function_calls_in_path(funcId, session)
        vuln_lines = set()
        for edge in cfg_path:
            firstNode = edge.nodes[0]
            if firstNode["Location"]:
                location = json.loads(firstNode["Location"])
                vuln_lines.add(location["start"]["line"])

            secondNode = edge.nodes[1]
            if secondNode["Location"]:
                location = json.loads(secondNode["Location"])
                vuln_lines.add(location["start"]["line"])

        # result["locs"] = list(locs)
        # if len(localCalls) > 0:
        #     otherCalls = []
        #     for localCall in localCalls:
        #         localCallFuncId = localCall["funcId"]
        #         localCallCFG = localCall["cfg_path"]
        #         localCallStmt = localCall["stmt"]

        #         if localCallStmt["Location"]:
        #             stmtLocation = json.loads(localCallStmt["Location"])

        #         otherCalls.append({
        #             "function_name": localCall["functionName"],
        #             "call_line": stmtLocation["start"]["line"],
        #             "lines": self.get_locs(localCallFuncId, localCallCFG, session)
        #         })

        #     if len(otherCalls) > 0:
        #         result["local_calls"] = otherCalls

        return list(vuln_lines) 