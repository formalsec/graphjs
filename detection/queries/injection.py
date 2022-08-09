from queries.query_type import QueryType
import json

class Injection(QueryType):
	def __init__(self):
		QueryType.__init__(self)


	def find_pdg_paths(self, session, sources, sinks):
		tainted_paths = []

		for source in sources:
			source_func = source['function'].get('Id')
			source_obj_id = source['param_obj'].get('Id')
			param = { "var": source["param"]["IdentifierName"] }

			for sink in sinks:
				funcName = sink["functionName"]
				sink_func = sink['function'].get('Id')
				sink_id = sink['sink'].get('Id')

				if source_func == sink_func:
					# print("Testing path between:")
					# print("\tsource - ", source_obj_id, ", and sink - ", sink_id)
					with session.begin_transaction() as tx:
						# QUERY 3
						# get (function, parameter) pairs that we consider source
						query = f"""
							MATCH
								(f:FunctionExpression)-[:AST]->(param),
								pdg_path=(param)-[create:PDG]->(source)-[:PDG*1..]->(sink),
								cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
							WHERE
								f.Id = '{source_func}' AND
								create.RelationType = 'CREATE' AND
								source.Id = '{source_obj_id}' AND
								sink.Id = '{sink_id}'
							RETURN *
						"""
						results = tx.run(query)

						if results.peek():
							record = list(results)[0]

							tainted_paths.append({
								"pdg_path": record["pdg_path"],
								"cfg_path": record["cfg_path"],
								"func": funcName,
								"param": param,
								"sink": sink['sinkName'],
								"ends": (source_obj_id, sink_id)
							})
		return tainted_paths


	def validate_pdg_paths(self, paths, param_types):
		results = []
		# detected vulnerability
		valid_paths = {}
		for p in paths:
			locs = set()
			func = p['func']
			sink = p['sink']
			pdg_path = p["pdg_path"]
			cfg_path = p["cfg_path"]

			for edge in cfg_path:
				firstNode = edge.nodes[0]
				if firstNode["Location"]:
					location = json.loads(firstNode["Location"])
					locs.add(location["start"]["line"])

				secondNode = edge.nodes[1]
				if secondNode["Location"]:
					location = json.loads(secondNode["Location"])
					locs.add(location["start"]["line"])

			param = p["param"]["var"]
			# verify that param is in pdg path

			for edge in pdg_path:
				firstNodeName = edge.nodes[0]["IdentifierName"]
				secondNodeName = edge.nodes[1]["IdentifierName"]

				if firstNodeName == param or secondNodeName == param:

					flow = {
						"sink": sink,
						"lines": list(locs),
					}

					if func in valid_paths:
						valid_paths[func]["flow"].append(flow)
					else:
						pResult = {}
						pResult["function"] = func
						pResult["params"] = param_types[func]
						pResult["flows"] = [ flow ]
						valid_paths[func] = pResult

		return list(valid_paths.values())