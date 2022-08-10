from pydoc import source_synopsis
from queries.query_type import QueryType
import my_utils.utils as my_utils
import json

class Injection(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Injection")


	def find_pdg_paths(self, session, sources, sinks):
		tainted_paths = []

		for source in sources:
			source_func = source['function'].get('Id')
			source_obj_id = source['source_obj'].get('Id')
			source_dict = { "var": source["source"]["IdentifierName"] }

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
								(f:FunctionExpression)-[:AST*1..]->(source_stmt),
								pdg_path=(source_stmt)-[create:PDG]->(source)-[:PDG*1..]->(sink),
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
								"function": source["function"],
								"func": funcName,
								"source": source_dict,
								"sink": sink['sinkName'],
								"ends": (source_obj_id, sink_id)
							})
		return tainted_paths


	def validate_pdg_paths(self, paths, param_types, session):
		results = []
		# detected vulnerability
		valid_paths = {}
		for p in paths:
			funcId = p['function'].get('Id')
			func = p['func']
			sink = p['sink']
			pdg_path = p["pdg_path"]
			cfg_path = p["cfg_path"]

			locs = self.get_locs(funcId, cfg_path, session)

			param = p["source"]["var"]
			# verify that param is in pdg path

			for edge in pdg_path:
				firstNodeName = edge.nodes[0]["IdentifierName"]
				secondNodeName = edge.nodes[1]["IdentifierName"]

				if firstNodeName == param or secondNodeName == param:

					flow = {
						"sink": sink,
						"source": param,
						"lines": locs,
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