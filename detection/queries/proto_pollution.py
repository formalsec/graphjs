
from queries.query_type import QueryType

class PrototypePollution(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Prototype Pollution")


	def find_tampered_objects(self, session, source, tamp_objs):
		source_obj_id = source["source_obj"].get('Id')
		source_func_id = source["function"].get('Id')
		with session.begin_transaction() as tx:
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param),
					(param)-[create:PDG]->(source)-[source_edge_assignment:PDG*1..]->(assignment:ExpressionStatement)-
				[write_edge:PDG]->(tamp_obj:PDG_OBJECT),
					(assignment)-[:AST]->(:AssignmentExpression)-[right:AST]->(val:Identifier)
				WHERE
					f.Id = '{source_func_id}' AND
					source.Id = '{source_obj_id}' AND
					create.RelationType = 'CREATE' AND
					write_edge.RelationType = 'WRITE' AND
					write_edge.IdentifierName = '*' AND
					right.RelationType = 'right' AND
					source_edge_assignment[-1].IdentifierName = val.IdentifierName
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				tamp_obj_id = record['tamp_obj'].get('Id')
				if tamp_obj_id not in tamp_objs:
					tamp_objs[tamp_obj_id] = {
						'function': record['f'],
						'tamp_obj': record['tamp_obj'],
						'assignment': record['assignment']
					}
	
	
	def find_assignment_paths(self, session, source, tamp_obj):
		assignment_paths = []
		source_func_id = source['function'].get('Id')
		source_obj_id = source['source_obj'].get('Id')
		source_dict = { "var": source["source"]["IdentifierName"] }
		tamp_obj_id = tamp_obj['tamp_obj'].get('Id')

		with session.begin_transaction() as tx:
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param), 
					(param)-[create:PDG]->(source:PDG_OBJECT)-[:PDG*1..]->(tamp_ref:PDG_OBJECT)<-
					[:PDG]->(sink:ExpressionStatement)
				MATCH
					(tamp_ref)<-[ref_edges_obj:PDG*1..]-(tamp_obj:PDG_OBJECT)<-
					[create_edge:PDG]-(:VariableDeclarator),
					cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
				WHERE
					f.Id = '{source_func_id}' AND
					create.RelationType = 'CREATE' AND
					source.Id = '{source_obj_id}' AND
					tamp_ref.Id = '{tamp_obj_id}' AND
					(ref_edges_obj[-1].RelationType = 'LOOKUP' OR ref_edges_obj[-1].RelationType = 'NEW_VERSION') AND
					create_edge.RelationType = 'CREATE'
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				assignment_paths.append({
					"cfg_path": record["cfg_path"],
					"function": source["function"],
					"func_name": source["functionName"],
					"tamp_obj": record["tamp_obj"],
					"source": source_dict,
					"ends": (source_obj_id, record["sink"].get('Id')),
				})

		return assignment_paths
	

	def validate_assignment_path(self, valid_paths, path, param_types, session):
		func_id = path['function'].get('Id')
		func_name = path['func_name']
		cfg_path = path['cfg_path']
		tamp_obj_name = path['tamp_obj'].get('IdentifierName').split('-')[0]

		locs = self.get_locs(func_id, cfg_path, session)

		param = path["source"]["var"]

		new_flow = {
			"tampered_object": tamp_obj_name,
			"sources": [ param ],
			"lines": locs,
		}

		if func_name in valid_paths:
			for flow in valid_paths[func_name]["flows"]:
				if flow["tampered_object"] == tamp_obj_name:
					flow["lines"] = locs if len(locs["locs"]) > len(flow["lines"]["locs"]) else flow["lines"]
					if param not in flow["sources"]:
						flow["sources"].append(param)
					break
			else:
				valid_paths[func_name]["flows"].append(new_flow)
		else:
			pResult = {}
			pResult["function"] = func_name
			pResult["params"] = param_types[func_name]
			pResult["flows"] = [ new_flow ]
			valid_paths[func_name] = pResult



	def find_pdg_paths(self, session, sources, sinks):
		tainted_paths = []
		tamp_objs = {}

		for source in sources:
			source_func = source['function'].get('Id')
			self.find_tampered_objects(session, source, tamp_objs)

		for source in sources:	
			for tamp_obj in tamp_objs.values():
					tamp_obj_func = tamp_obj['function'].get('Id')
					if source_func == tamp_obj_func:
						tainted_paths.extend(self.find_assignment_paths(session, source, tamp_obj))

		return tainted_paths


	def validate_pdg_paths(self, paths, param_types, session):
		valid_paths = {}
		for p in paths:
			func_id = p['function'].get('Id')
			func_name = p['func_name']
			cfg_path = p['cfg_path']
			tamp_obj_name = p['tamp_obj'].get('IdentifierName').split('-')[0]

			locs = self.get_locs(func_id, cfg_path, session)

			param = p["source"]["var"]

			new_flow = {
				"tampered_object": tamp_obj_name,
				"sources": [ param ],
				"lines": locs,
			}

			if func_name in valid_paths:
				for flow in valid_paths[func_name]["flows"]:
					if flow["tampered_object"] == tamp_obj_name:
						flow["lines"] = locs if len(locs["locs"]) > len(flow["lines"]["locs"]) else flow["lines"]
						if param not in flow["sources"]:
							flow["sources"].append(param)
						break
				else:
					valid_paths[func_name]["flows"].append(new_flow)
			else:
				pResult = {}
				pResult["function"] = func_name
				pResult["params"] = param_types[func_name]
				pResult["flows"] = [ new_flow ]
				valid_paths[func_name] = pResult
		return list(valid_paths.values())