from neo4j import GraphDatabase

def find_sink_function_calls(session, sink):
	sink_calls = []
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			MATCH
				(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
			WHERE
				init.RelationType = 'init' AND
				callee.RelationType = 'callee' AND
				e.IdentifierName = '{sink}'
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			sink_calls.append({
				'function': record['f'],
				'sink': record['stmt'],
			})

	return sink_calls


def find_source_objects_and_variables(session):
	params = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(f:FunctionExpression)-[param:AST]-(p:Identifier)
			WHERE
				param.RelationType = 'param'
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			params.append({
				'function': record['f'],
				'param': record['p']
			})

	param_objects = []
	for param in params:
		p_function = param['function'].get('Id')
		p = param['param'].get('IdentifierName')
		with session.begin_transaction() as tx:
			# QUERY 3
			# get (function, pdg_object) pairs that we consider source
			query = f"""
				MATCH
					(f:FunctionExpression)-[c:PDG]->(obj:PDG_OBJECT)
				WHERE
					f.Id = '{p_function}' AND
					c.RelationType = 'CREATE' AND
					c.IdentifierName = '{p}'
				RETURN *
			"""
			results = tx.run(query)

			if results.peek():
				for record in results:
					param_objects.append({
						'function': record['f'],
						'param_obj': record['obj'],
						'param': param['param'],
					})
			else:
				param_objects.append(param)

	return param_objects


def find_pdg_paths(session, sources, sinks):
	tainted_paths = []

	for source in sources:
		source_func = source['function'].get('Id')
		source_param_id = source['param'].get('Id')
		source_param_obj_id = source['param_obj'].get('Id')

		for sink in sinks:
			sink_func = sink['function'].get('Id')
			sink_id = sink['sink'].get('Id')

			if source_func == sink_func:
				print("Testing path between:")
				print("\tsource - ", source_param_id, ", and sink - ", sink_id)
				with session.begin_transaction() as tx:
					# QUERY 3
					# get (function, parameter) pairs that we consider source
					query = f"""
						MATCH
							(source)<-[:AST]-(f:FunctionExpression)-[:PDG*1..]->(sink)
						WHERE
							f.Id = '{source_func}' AND
							source.Id = '{source_param_id}' AND
							sink.Id = '{sink_id}'
						RETURN *
					"""
					results = tx.run(query)

					if results.peek():
						tainted_paths.append((source_param_id, sink_id))

				print("\tsource - ", source_param_obj_id, ", and sink - ", sink_id)
				with session.begin_transaction() as tx:
					# QUERY 3
					# get (function, parameter) pairs that we consider source
					query = f"""
						MATCH
							(source)<-[:AST]-(f:FunctionExpression)-[:PDG*1..]->(sink)
						WHERE
							f.Id = '{source_func}' AND
							source.Id = '{source_param_obj_id}' AND
							sink.Id = '{sink_id}'
						RETURN *
					"""
					results = tx.run(query)

					if results.peek():
						tainted_paths.append((source_param_obj_id, sink_id))

	return tainted_paths


NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))
with neo_driver.session() as session:
	calls = find_sink_function_calls(session, 'eval')
	# print(calls)
	params = find_source_objects_and_variables(session)
	print(params)
	paths = find_pdg_paths(session, params, calls)

	if len(paths) > 0:
		# detected vulnerability
		for p in paths:
			print("Detected vulnerability in the following (source, sink) pair nodes: ", p)
	else:
		print("No vulnerability detected for that source and sink")