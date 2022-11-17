import my_utils.utils as my_utils

def find_explicit_sink_calls(session, sinks):
	sink_calls = []
	sink_names = list(sinks.keys())
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]-(c:CallExpression)-[callee:AST]->(e:Identifier)
			WHERE
				callee.RelationType = 'callee' AND
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sink_name = record['e'].get('IdentifierName')
			sink_calls.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sink': record['stmt'],
				'sinkName': sink_name,
				'sink_vuln_arg': sinks[sink_name]
			})

	return sink_calls

def find_package_sink_calls(session, sinks):
	sink_calls = []
	sink_names = list(sinks.keys())
	with session.begin_transaction() as tx:
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]-(:CallExpression)-
			[ast_callee:AST]->(:Identifier),
				(stmt)<-[pdg_edges:PDG*1..]-(var_or_expr)-[:AST*1..2]->(require_call:CallExpression)
			WHERE
				ast_callee.RelationType = 'callee' AND
				pdg_edges[0].RelationType = 'CALLEE' AND
				pdg_edges[-2].RelationType = 'LOOKUP' AND pdg_edges[-2].IdentifierName in SINKS AND
				(var_or_expr:VariableDeclarator or var_or_expr:ExpressionStatement)
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sink_name = record['pdg_edges'][-2].get('IdentifierName')
			sink_calls.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sink': record['stmt'],
				'sinkName': sink_name,
				'packages': sinks[sink_name],
				'require_call': record['require_call']
			})

	return sink_calls


def find_explicit_new_sink_calls(session, sinks):
	sink_calls = []
	sink_names = list(sinks.keys())
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]-(n:NewExpression)-[callee:AST]->(e:Identifier)
			WHERE
				callee.RelationType = 'callee' AND
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sink_name = record['e'].get('IdentifierName')
			sink_calls.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sink': record['stmt'],
				'sinkName': sink_name,
				'sink_vuln_arg': sinks[sink_name]
			})

	return sink_calls


def find_implicit_sink_calls(session, sinks):
	assignments = []
	sink_names = list(sinks.keys())
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]->(e:Identifier)
			WHERE
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			assignments.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sinkName': record['stmt'].get('IdentifierName'),
				'originalSinkName': record['e'].get('IdentifierName'),
			})

	sink_calls = []
	for assignment in assignments:
		func_Id = assignment["function"].get('Id')
		func_name = assignment["functionName"]
		sink_name = assignment["sinkName"]
		original_sink_name = assignment["originalSinkName"]
		with session.begin_transaction() as tx:
			# QUERY 1
			# get (function, sink statement) pair that holds the call to a sink
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
				WHERE
					f.Id = '{func_Id}' AND
					init.RelationType = 'init' AND
					callee.RelationType = 'callee' AND
					e.IdentifierName = '{sink_name}'
				RETURN *
			"""
			results = tx.run(query)
			for record in results:
				sink_calls.append({
					'function': record['f'],
					'functionName': func_name,
					'sink': record['stmt'],
					'sinkName': sink_name,
					'originalSinkName': original_sink_name,
					'sink_vuln_arg': sinks[original_sink_name]
				})

	return sink_calls


def find_implicit_new_sink_calls(session, sinks):
	assignments = []
	sink_names = list(sinks.keys())
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sink_names} as SINKS
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt)-[:AST*1..2]->(e:Identifier)
			WHERE
				e.IdentifierName in SINKS
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			assignments.append({
				'function': record['f'],
				'functionName': record['v'].get('IdentifierName'),
				'sinkName': record['stmt'].get('IdentifierName'),
				'originalSinkName': record['e'].get('IdentifierName'),
			})

	sink_calls = []
	for assignment in assignments:
		func_Id = assignment["function"].get('Id')
		func_name = assignment["functionName"]
		sink_name = assignment["sinkName"]
		original_sink_name = assignment["originalSinkName"]
		with session.begin_transaction() as tx:
			# QUERY 1
			# get (function, sink statement) pair that holds the call to a sink
			query = f"""
				MATCH
					(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(n:NewExpression)-[callee:AST]->(e:Identifier)
				WHERE
					f.Id = '{func_Id}' AND
					init.RelationType = 'init' AND
					callee.RelationType = 'callee' AND
					e.IdentifierName = '{sink_name}'
				RETURN *
			"""
			results = tx.run(query)
			for record in results:
				sink_calls.append({
					'function': record['f'],
					'functionName': func_name,
					'sink': record['stmt'],
					'sinkName': sink_name,
					'originalSinkName': original_sink_name,
					'sink_vuln_arg': sinks[original_sink_name]
				})

	return sink_calls


def find_sink_function_calls(session, sinks, package_sinks, new_sinks):
	sink_calls = find_explicit_sink_calls(session, sinks)
	sink_calls.extend(find_implicit_sink_calls(session, sinks))
	sink_calls.extend(find_package_sink_calls(session, package_sinks))
	sink_calls.extend(find_explicit_new_sink_calls(session, new_sinks))
	sink_calls.extend(find_implicit_new_sink_calls(session, new_sinks))
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

# check if require("process")
# check if process.argv
def find_argv(session):
	sources_list = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(stmt1:VariableDeclarator)-[init1:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier),
				(c)-[arg:AST]->(process:Literal),
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt2:VariableDeclarator)-[init2:AST]-(m:MemberExpression)-[object:AST]->(p:Identifier),
				(m)-[property:AST]->(argv:Identifier),
				(stmt2)-[create:PDG]->(obj:PDG_OBJECT)
			WHERE
				init1.RelationType = 'init' AND
				callee.RelationType = 'callee' AND
				e.IdentifierName = 'require' AND
				arg.RelationType = 'arg' AND
				process.Raw = '\\'process\\'' AND
				init2.RelationType = 'init' AND
				object.RelationType = 'object' AND
				property.RelationType = 'property' AND
				p.IdentifierName = 'process' AND
				argv.IdentifierName = 'argv'
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sources_list.append({
				'functionName': record['v'].get('IdentifierName'),
				'function': record['f'],
				'source_type': "argv",
				'source': record['stmt2'],
				'source_obj': record['obj']
			})
	return sources_list


def find_source_objects_variables_and_functions(session, sources):
	params = find_params(session)
	other_sources = find_other_sources(session, sources)
	argv_source = find_argv(session)
	params.extend(other_sources)
	params.extend(argv_source)
	return params