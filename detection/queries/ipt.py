from queries.query_type import QueryType

class InternalPrototypeTampering(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Internal Prototype Tampering")


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
				value = record["source"]
				tamp_obj_id = record['tamp_obj'].get('Id')
				if tamp_obj_id not in tamp_objs:
					tamp_objs[tamp_obj_id] = {
						'function': record['f'],
						'tamp_obj': record['tamp_obj'],
						'assignment': record['assignment'],
						'values': [ value ]
					}
				else:
					if value not in tamp_objs[tamp_obj_id]["values"]:
						tamp_objs[tamp_obj_id]["values"].append(value)
	
	
	def find_first_level_lookup_paths(self, session, source, tamp_obj):
		lookup_paths = []
		source_func_id = source['function'].get('Id')
		source_obj_id = source['source_obj'].get('Id')
		source_dict = { "var": source["source"]["IdentifierName"] }
		tamp_obj_id = tamp_obj['tamp_obj'].get('Id')

		with session.begin_transaction() as tx:
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param),
					(param)-[create:PDG]->(source)-[v:PDG*1..]->(assignment:ExpressionStatement)-
				[assign_edge:PDG]->(tamp_ref:PDG_OBJECT)<-[ref_edge_obj:PDG]-(tamp_obj:PDG_OBJECT)-
				[lookup_edge:PDG]->(sink:VariableDeclarator),
					cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
				WHERE
					f.Id = '{source_func_id}' AND
					source.Id = '{source_obj_id}' AND
					create.RelationType = 'CREATE' AND
					assign_edge.RelationType = 'WRITE' AND
					ref_edge_obj.RelationType = 'NEW_VERSION' AND
					lookup_edge.RelationType = 'LOOKUP' AND
					tamp_ref.Id = '{tamp_obj_id}'
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				lookup_paths.append({
					"path_type": "lookup",
					"cfg_path": record["cfg_path"],
					"function": source["function"],
					"func_name": source["functionName"],
					"tamp_obj": record["tamp_obj"],
					"source": source_dict,
					"values": tamp_obj["values"],
					"property": record["lookup_edge"].get('IdentifierName'),
					"ends": (source_obj_id, record["sink"].get('Id')),
				})

		return lookup_paths
	

	def find_other_level_lookup_paths(self, session, source, tamp_obj):
		lookup_paths = []
		source_func_id = source['function'].get('Id')
		source_obj_id = source['source_obj'].get('Id')
		source_dict = { "var": source["source"]["IdentifierName"] }
		tamp_obj_id = tamp_obj['tamp_obj'].get('Id')

		with session.begin_transaction() as tx:
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param), 
					(param)-[create:PDG]->(source:PDG_OBJECT)-[:PDG*1..]->(tamp_ref:PDG_OBJECT)
				MATCH
					(tamp_ref)<-[ref_edges_obj:PDG*1..]-(tamp_obj:PDG_OBJECT),
					(tamp_obj)-[lookup_edge:PDG]->(sink:VariableDeclarator),
					cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
				WHERE
					f.Id = '{source_func_id}' AND
					create.RelationType = 'CREATE' AND
					source.Id = '{source_obj_id}' AND
					tamp_ref.Id = '{tamp_obj_id}' AND
					(ref_edges_obj[-1].RelationType = 'LOOKUP' OR ref_edges_obj[-1].RelationType = 'NEW_VERSION') AND
					//ref_edges_obj[-1].RelationType = 'LOOKUP' AND
					lookup_edge.RelationType = 'LOOKUP' AND 
					NOT EXISTS(lookup_edge.SourceObjName)
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				lookup_paths.append({
					"path_type": "lookup",
					"cfg_path": record["cfg_path"],
					"function": source["function"],
					"func_name": source["functionName"],
					"tamp_obj": record["tamp_obj"],
					"source": source_dict,
					"values": tamp_obj["values"],
					"property": record["lookup_edge"].get('IdentifierName'),
					"ends": (source_obj_id, record["sink"].get('Id')),
				})

		return lookup_paths
	

	def find_return_paths(self, session, source, tamp_obj):
		return_paths = []
		source_func_id = source['function'].get('Id')
		source_obj_id = source['source_obj'].get('Id')
		source_dict = { "var": source["source"]["IdentifierName"] }
		tamp_obj_id = tamp_obj['tamp_obj'].get('Id')

		with session.begin_transaction() as tx:
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST]->(param), 
					(param)-[create:PDG]->(source:PDG_OBJECT)-[:PDG*1..]->(tamp_ref:PDG_OBJECT)
				MATCH
					(tamp_ref)<-[ref_edges_obj:PDG*1..]-(tamp_obj:PDG_OBJECT),
					(tamp_obj)-[var_edge:PDG]->(sink:ReturnStatement),
					cfg_path=(s:CFG_F_START)-[:CFG*1..]->(sink)
				WHERE
					f.Id = '{source_func_id}' AND
					create.RelationType = 'CREATE' AND
					source.Id = '{source_obj_id}' AND
					tamp_ref.Id = '{tamp_obj_id}' AND
					var_edge.RelationType = 'VAR' 
				RETURN *
			"""

			results = tx.run(query)

			for record in results:
				return_paths.append({
					"path_type": "return",
					"cfg_path": record["cfg_path"],
					"function": record["f"],
					"func_name": source["functionName"],
					"tamp_obj": record["tamp_obj"],
					"source": source_dict,
					"values": tamp_obj["values"],
					"returned_var": record["var_edge"].get('IdentifierName'),
					"ends": (source_obj_id, record["sink"].get('Id')),
				})

		return return_paths 

	def validate_lookup_path(self, valid_paths, path, param_types, session):
		func_id = path['function'].get('Id')
		func_name = path['func_name']
		cfg_path = path['cfg_path']
		tamp_obj_name = path['tamp_obj'].get('IdentifierName').split('-')[0]
		prop = path["property"]
		values = [ val.get('IdentifierName').split('-')[0] for val in path["values"] ]

		locs = self.get_locs(func_id, cfg_path, session)

		param = path["source"]["var"]

		new_flow = {
			"tampered_object": tamp_obj_name,
			"sources": [ param ],
			"values": values,
			"properties": [ prop ],
			"returned_vars": [],
			"lines": locs,
		}

		if func_name in valid_paths:
			for flow in valid_paths[func_name]["flows"]:
				if flow["tampered_object"] == tamp_obj_name:
					flow["lines"] = locs if len(locs["locs"]) > len(flow["lines"]["locs"]) else flow["lines"]
					if prop not in flow["properties"]:
						flow["properties"].append(prop)
					if param not in flow["sources"]:
						flow["sources"].append(param)
					if values != flow["values"]:
						flow["values"] = list(set(values + flow["values"]))
					break
			else:
				valid_paths[func_name]["flows"].append(new_flow)
		else:
			pResult = {}
			pResult["function"] = func_name
			pResult["params"] = param_types[func_name]
			pResult["flows"] = [ new_flow ]
			valid_paths[func_name] = pResult


	def validate_return_path(self, valid_paths, path, param_types, session):
		func_id = path['function'].get('Id')
		func_name = path['func_name']
		cfg_path = path['cfg_path']
		tamp_obj_name = path['tamp_obj'].get('IdentifierName').split('-')[0]
		values = [ val.get('IdentifierName').split('-')[0] for val in path["values"] ]
		returned_var = path["returned_var"]

		locs = self.get_locs(func_id, cfg_path, session)

		param = path["source"]["var"]

		new_flow = {
			"tampered_object": tamp_obj_name,
			"sources": [ param ],
			"properties": [],
			"values": values,
			"returned_vars": [ returned_var ],
			"lines": locs,
		}

		if func_name in valid_paths:
			for flow in valid_paths[func_name]["flows"]:
				if flow["tampered_object"] == tamp_obj_name or flow["tampered_object"] == tamp_obj_name:
					flow["lines"] = locs if len(locs["locs"]) > len(flow["lines"]["locs"]) else flow["lines"]
					if returned_var not in flow["returned_vars"]:
						flow["returned_vars"].append(returned_var)
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
						# tainted_paths.extend(self.find_first_level_lookup_paths(session, source, tamp_obj))
						tainted_paths.extend(self.find_other_level_lookup_paths(session, source, tamp_obj))
						tainted_paths.extend(self.find_return_paths(session, source, tamp_obj))

		return tainted_paths


	def validate_pdg_paths(self, paths, param_types, session):
		valid_paths = {}
		for p in paths:
			if p['path_type'] == 'lookup':	
				self.validate_lookup_path(valid_paths, p, param_types, session)
			elif p['path_type'] == 'return': 
				self.validate_return_path(valid_paths, p, param_types, session)
		return list(valid_paths.values())