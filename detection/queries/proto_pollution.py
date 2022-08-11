from signal import valid_signals
from queries.query_type import QueryType
import json

class ProtoPollution(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Prototype Pollution")


	def find_pdg_paths(self, session, sources, sinks):
		tainted_paths = []

		for source in sources:
			source_func = source['function'].get('Id')
			source_obj_id = source['source_obj'].get('Id')
			source_dict = { "var": source["source"]["IdentifierName"] }

			with session.begin_transaction() as tx:
				query = f"""
					MATCH
						(f:FunctionExpression)-[:AST]->(param),
						pdg_path=(param)-[create:PDG]->(source)-[var:PDG*1..]->(sink:ExpressionStatement)-[assign:PDG]->(:PDG_OBJECT),
						cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
					WHERE
						f.Id = '{source_func}' AND
						source.Id = '{source_obj_id}' AND
						create.RelationType = 'CREATE' AND
						assign.RelationType = 'WRITE' AND
						assign.SourceObjName = var[-1].IdentifierName
					RETURN *
				"""
				results = tx.run(query)

				if results.peek():
					record = list(results)[0]

					tainted_paths.append({
						"pdg_path": record["pdg_path"],
						"cfg_path": record["cfg_path"],
						"function": source["function"],
						"func": source['functionName'],
						"source": source_dict,
						#"sink": sink['sinkName'],
						#"ends": (source_obj_id, sink_id)
					})
		return tainted_paths


	def validate_pdg_paths(self, paths, param_types, session):
		valid_paths = {}
		for p in paths:
			funcId = p['function'].get('Id')
			func = p['func']
			pdg_path = p['pdg_path']
			cfg_path = p['cfg_path']

			locs = self.get_locs(funcId, cfg_path, session)

			param = p["source"]["var"]

			for edge in pdg_path:		

				firstNodeName = edge.nodes[0]["IdentifierName"]
				secondNodeName = edge.nodes[1]["IdentifierName"]

				if firstNodeName == param or secondNodeName == param:
					flow = {
						"sink": "Proto - missing sink",
						"source": param,
						"lines": locs
					}

					if func in valid_paths:
						valid_paths[func]["flows"].append(flow)
					else:
						pResult = {}
						pResult["function"] = func
						pResult["params"] = param_types[func]
						pResult["flows"] = [ flow ]
						valid_paths[func] = pResult
		
		return list(valid_paths.values())