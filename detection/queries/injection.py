from queries.query_type import QueryType
import my_utils.utils as my_utils

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
				sink_name = sink['sinkName']

				if "originalSinkName" in sink:
					sink_name = sink["originalSinkName"]

				if source_func == sink_func:
					# print("Testing path between:")
					# print("\tsource - ", source_obj_id, ", and sink - ", sink_id)
					with session.begin_transaction() as tx:
						# QUERY 3
						# get (function, parameter) pairs that we consider source
						if "packages" in sink.keys():
							require_call_id = sink["require_call"].get("Id")
							for package in sink["packages"]:
								package_name = package["package"]
								sink_vuln_arg = package["arg"] if isinstance(package["arg"], list) else [ package["arg"] ]
								query = f"""
									MATCH
										(f:FunctionExpression)-[:AST*1..]->(source_stmt),
										pdg_path=(source_stmt)-[create:PDG]->(source)-[pdg_edges:PDG*1..]->(sink),
										(sink)-[:AST*1..2]->(cn)-[sink_arg_edges:AST*1..2]->(sink_arg:Identifier),
										(require_call)-[require_callee:AST]->(require_identifier:Identifier),
										(require_call)-[req_arg_edge:AST]->(require_literal:Literal),
										cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
									WHERE
										f.Id = '{source_func}' AND
										source.Id = '{source_obj_id}' AND
										sink.Id = '{sink_id}' AND
										require_call.Id = '{require_call_id}' AND
										create.RelationType = 'CREATE' AND
										(cn.Type = 'CallExpression' or cn.Type = 'NewExpression') AND
										sink_arg_edges[0].RelationType = 'arg' AND sink_arg_edges[0].ArgumentIndex in {sink_vuln_arg} AND
										pdg_edges[-1].IdentifierName = sink_arg.IdentifierName AND
										require_callee.RelationType = 'callee' AND
										require_identifier.IdentifierName = 'require' AND
										require_literal.Raw = "'{package_name}'" AND
										req_arg_edge.ArgumentIndex = '1'
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
										"sink": sink_name,
										"ends": (source_obj_id, sink_id)
									})
						else:
							sink_vuln_arg = sink["sink_vuln_arg"] if isinstance(sink["sink_vuln_arg"], list) else [ sink["sink_vuln_arg"] ]
							query = f"""
								MATCH
									(f:FunctionExpression)-[:AST*1..]->(source_stmt),
									pdg_path=(source_stmt)-[create:PDG]->(source)-[pdg_edges:PDG*1..]->(sink),
									(sink)-[:AST*1..2]->(cn)-[sink_arg_edges:AST*1..2]->(sink_arg:Identifier),
									cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
								WHERE
									f.Id = '{source_func}' AND
									source.Id = '{source_obj_id}' AND
									sink.Id = '{sink_id}' AND
									(cn.Type = 'CallExpression' or cn.Type = 'NewExpression') AND
									create.RelationType = 'CREATE' AND
									sink_arg_edges[0].RelationType = 'arg' AND sink_arg_edges[0].ArgumentIndex in {sink_vuln_arg} AND
									pdg_edges[-1].IdentifierName = sink_arg.IdentifierName
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
									"sink": sink_name,
									"sink_id": sink_id,
									"ends": (source_obj_id, sink_id)
								})

		return tainted_paths

	def validate_pdg_paths(self, paths, param_types, session):
		# detected vulnerability
		valid_paths = {}
		for p in paths:
			funcId = p['function'].get('Id')
			func = p['func']
			sink = p['sink']
			sink_id = p['sink_id']
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
						"vuln_type": "injection",
						"sink": sink,
						"function": func,
						"params": [param["name"] for param in param_types[func]],
						"vars": param_types[func],
						"lines": locs,
					}

					if sink_id not in valid_paths.keys():
						valid_paths[sink_id] = flow

		return list(valid_paths.values())