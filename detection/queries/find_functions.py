import my_utils.utils as my_utils

def find_explicit_sink_calls(session, sinks):
	sink_calls = []
	sink_names = [sink["sink"] for sink in sinks]
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
			WHERE
				init.RelationType = 'init' AND
				callee.RelationType = 'callee' AND
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sink_calls.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sink': record['stmt'],
				'sinkName': record['e'].get('IdentifierName'),
			})

	return sink_calls

def find_package_sink_calls(session, sinks):
	sink_calls = []
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		for sink in sinks:
			for package in sink["packages"]:
				query = f"""
					MATCH
						(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]-(:CallExpression)-
					[ast_callee:AST]->(:Identifier),
						(stmt)<-[pdg_edges:PDG*1..]-(require_stmt:VariableDeclarator)-[require_init:AST]->(call:CallExpression),
						(call)-[require_callee:AST]->(require_identifier:Identifier),
						(call)-[arg_edge:AST]->(require_literal:Literal)
					WHERE
						ast_callee.RelationType = 'callee' AND
						pdg_edges[0].RelationType = 'CALLEE' AND
						pdg_edges[-2].RelationType = 'LOOKUP' AND pdg_edges[-2].IdentifierName = '{sink["sink"]}' AND
						require_init.RelationType = 'init' AND
						require_callee.RelationType = 'callee' AND
						require_identifier.IdentifierName = 'require' AND 
						require_literal.Raw = "'{package["package"]}'" AND 
						arg_edge.ArgumentIndex = '1'
					RETURN *
				"""
				results = tx.run(query)
				for record in results:
					sink_calls.append({
						'function': record['f'],
						'functionName': record['v'].get('IdentifierName'),
						'sink': record['stmt'],
						'sinkName': record['pdg_edges'][-2].get('IdentifierName'),
						'vuln_arg': package["arg"]
					})
	return sink_calls


def find_implicit_sink_calls(session, sinks):
	assignments = []
	sink_names = [sink["sink"] for sink in sinks]
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]->(e:Identifier)
			WHERE
				init.RelationType = 'init' AND
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			assignments.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sinkName': record['stmt'].get('IdentifierName'),
				'originalSinkName': record['e'].get('IdentifierName')
			})

	sink_calls = []
	for assignment in assignments:
		funcId = assignment["function"].get('Id')
		funcName = assignment["functionName"]
		sinkName = assignment["sinkName"]
		originalSinkName = assignment["originalSinkName"]
		with session.begin_transaction() as tx:
			# QUERY 1
			# get (function, sink statement) pair that holds the call to a sink
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
				WHERE
					f.Id = '{funcId}' AND
					init.RelationType = 'init' AND
					callee.RelationType = 'callee' AND
					e.IdentifierName = '{sinkName}'
				RETURN *
			"""
			results = tx.run(query)
			for record in results:
				sink_calls.append({
					'function': record['f'],
					'functionName': funcName,
					'sink': record['stmt'],
					'sinkName': sinkName,
					'originalSinkName': originalSinkName
				})

	return sink_calls


def find_sink_function_calls(session, sinks, package_sinks):
	sink_calls = find_explicit_sink_calls(session, sinks)
	sink_calls.extend(find_implicit_sink_calls(session, sinks))
	sink_calls.extend(find_package_sink_calls(session, package_sinks))
	return sink_calls


def find_obj_properties(objId, session):
	propertyNames = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(obj:PDG_OBJECT)-[lookup:PDG]->(s)
			WHERE
				obj.Id = '{objId}' AND
				lookup.RelationType = 'LOOKUP'
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			propertyNames.append(record['lookup'].get('IdentifierName'))

	properties = []
	for propName in propertyNames:
		subObjProp = find_sub_obj_ids(objId, propName, session)
		if 'sub_obj' in subObjProp:
			subProps = find_obj_properties(subObjProp['sub_obj'], session)

			if len(subProps) > 0:
				property = {
					'prop_name': propName,
					'type': "object",
					'properties': subProps
				}
			else:
				property = {
					'prop_name': propName,
					'type': "symbolic",
				}
		else:
			property = subObjProp
		properties.append(property)
	return properties


def find_sub_obj_ids(objId, subObjName, session):
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(obj:PDG_OBJECT)-[sub:SUB]->(subObj)
			WHERE
				obj.Id = '{objId}' AND
				sub.RelationType = 'SUB_OBJECT' AND
				sub.IdentifierName = "{subObjName}"
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			return {
				'prop_name': subObjName,
				'sub_obj': record['subObj'].get('Id')
			}

	return {
		'prop_name': subObjName
	}


def find_param_objects_and_types(params, session):
	paramTypes = {}

	for p in params:

		funcName = p['functionName']
		sourceType = p['source_type']
		if sourceType == "param":

			paramName = p['source'].get('IdentifierName')
			paramObjId = p['source_obj'].get('Id')
			properties = find_obj_properties(paramObjId, session)

			if not funcName in paramTypes:
				paramTypes[funcName] = []

			if len(properties) > 0:
				data = {
					'var': paramName,
					'type': "object",
					'properties': properties,
				}
			else:
				data = {
					'var': paramName,
					'type': "symbolic"
				}

			paramTypes[funcName].append(data)
		else:
			paramTypes[funcName] = []
	return paramTypes


def find_params(session):
	params = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[param:AST]-(p:Identifier)-[create:PDG]->(obj:PDG_OBJECT)
			WHERE
				param.RelationType = 'param' AND
				create.IdentifierName = p.IdentifierName
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			params.append({
				'functionName': record['v'].get('IdentifierName'),
				'function': record['f'],
				'source_type': "param",
				'source': record['p'],
				'source_obj': record['obj']
			})
	return params


def find_other_sources(session, sources):
	sources_list = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			WITH {sources} as SOURCES
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier),
				(stmt)-[create:PDG]->(obj:PDG_OBJECT)
			WHERE
				init.RelationType = 'init' AND
				callee.RelationType = 'callee' AND
				e.IdentifierName in SOURCES
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sources_list.append({
				'functionName': record['v'].get('IdentifierName'),
				'function': record['f'],
				'source_type': "function",
				'source': record['stmt'],
				'source_obj': record['obj']
			})
	return sources_list


def find_source_objects_variables_and_functions(session, sources):
	params = find_params(session)
	other_sources = find_other_sources(session, sources)
	params.extend(other_sources)
	return params