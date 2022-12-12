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
					(param)-[create:PDG]->(source:PDG_OBJECT)-[source_edge_assignment:PDG*1..]->(assignment:ExpressionStatement)-
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
						'assignment': record['assignment'],
					}
	
	
	def find_assignment_paths(self, session, source, tamp_obj):
		assignment_paths = []
		source_func_id = source['function'].get('Id')
		source_obj_id = source['source_obj'].get('Id')
		source_dict = { "var": source["source"]["IdentifierName"] }
		tamp_obj_id = tamp_obj['tamp_obj'].get('Id')

		with session.begin_transaction() as tx:
			# False positives for one level assignments
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param), 
					(param)-[create:PDG]->(source:PDG_OBJECT)-[:PDG*1..]->(tamp_ref:PDG_OBJECT)
				MATCH
					(sink:ExpressionStatement)-[:PDG]->(tamp_ref)<-[ref_edges_obj:PDG*1..]-(tamp_obj:PDG_OBJECT)<-
				[create_obj_edge:PDG]-(cfg_obj),
					cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
				WHERE
					f.Id = '{source_func_id}' AND
					create.RelationType = 'CREATE' AND
					source.Id = '{source_obj_id}' AND
					tamp_ref.Id = '{tamp_obj_id}' AND
					(ref_edges_obj[-1].RelationType = 'LOOKUP' OR ref_edges_obj[-1].RelationType = 'NEW_VERSION') AND
					create_obj_edge.RelationType = 'CREATE'
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				assignment_paths.append({
					"cfg_path": record["cfg_path"],
					"function": source["function"],
					"func_name": source["functionName"],
					"tamp_obj": record["tamp_obj"],
					"tamp_obj_id": tamp_obj_id,
					"source": source_dict,
				})

		return assignment_paths
	

	def find_pdg_paths(self, session, sources, sinks):
		tainted_paths = []
		tamp_objs = {}

		for source in sources:
			self.find_tampered_objects(session, source, tamp_objs)

		for source in sources:	
			for tamp_obj in tamp_objs.values():
				tainted_paths.extend(self.find_assignment_paths(session, source, tamp_obj))

		return tainted_paths


	def validate_pdg_paths(self, paths, param_types, session):
		valid_paths = {}
		for p in paths:
			func_id = p['function'].get('Id')
			func_name = p['func_name']
			cfg_path = p['cfg_path']
			tamp_obj_id = p['tamp_obj_id']

			locs = self.get_locs(func_id, cfg_path, session)

			flow = {
				"vuln_type": "prototype pollution",
				"function": func_name,
				"params": [param["name"] for param in param_types[func_name]],
				"vars": param_types[func_name],
				"lines": locs,
			}

			if tamp_obj_id not in valid_paths.keys():
				valid_paths[tamp_obj_id] = flow

		return list(valid_paths.values())