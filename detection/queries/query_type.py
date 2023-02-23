from abc import abstractmethod
import json
import my_utils.utils as my_utils

class QueryType:
    def __init__(self, str_type):
        self.type = str_type


    def get_type(self):
        return self.type

    def get_function_calls_in_path(self, funcId, session):
        calls = []
        with session.begin_transaction() as tx:
            # QUERY 3
            # get (function, parameter) pairs that we consider source
            query = f"""
                MATCH
                    (f1:FunctionExpression)-[:AST*1..]->(stmt)-[init1:AST]->(fCall:CallExpression)-[callee:AST]->(fName:Identifier),
                    (v:VariableDeclarator)-[init2:AST]->(f2:FunctionExpression),
                    (v)-[:FD]->(start:CFG_F_START),
                    cfg_path=(start)-[:CFG*1..]->(end:CFG_F_END)
                WHERE
                    f1.Id = '{funcId}' AND
                    init1.RelationType = 'init' AND
                    callee.RelationType = 'callee' AND
                    v.IdentifierName = fName.IdentifierName
                RETURN *
            """
            results = tx.run(query)

            for record in results:
                calls.append({
                    'funcId': record['f2'].get('Id'),
                    'functionName': record['fName'].get('IdentifierName'),
                    'stmt': record['stmt'],
                    'cfg_path': record['cfg_path']
                })
        return calls


    def get_locs(self, funcId, cfg_path, session):
        result = {}
        localCalls = self.get_function_calls_in_path(funcId, session)
        locs = set()
        for edge in cfg_path:
            firstNode = edge.nodes[0]
            if firstNode["Location"]:
                location = json.loads(firstNode["Location"])
                locs.add(location["start"]["line"])

            secondNode = edge.nodes[1]
            if secondNode["Location"]:
                location = json.loads(secondNode["Location"])
                locs.add(location["start"]["line"])

        result["locs"] = list(locs)
        if len(localCalls) > 0:
            otherCalls = []
            for localCall in localCalls:
                localCallFuncId = localCall["funcId"]
                localCallCFG = localCall["cfg_path"]
                localCallStmt = localCall["stmt"]

                if localCallStmt["Location"]:
                    stmtLocation = json.loads(localCallStmt["Location"])

                otherCalls.append({
                    "function_name": localCall["functionName"],
                    "call_line": stmtLocation["start"]["line"],
                    "lines": self.get_locs(localCallFuncId, localCallCFG, session)
                })

            if len(otherCalls) > 0:
                result["local_calls"] = otherCalls

        return result


    @abstractmethod
    def find_vulnerable_paths(self, session):
        pass


    @abstractmethod
    def validate_pdg_paths(self, paths, param_types):
        pass