from neo4j import GraphDatabase

def find_sink_function_calls(session, sink):
	sink_calls = []
	with session.begin_transaction() as tx:
		# QUERY 1
		# get statement holding the call to a sink
		query = f"""
			MATCH
				(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
			WHERE 
				init.RelationType = 'init' AND
				callee.RelationType = 'callee' AND
				e.IdentifierName = '{sink}'
			RETURN *
		"""
		results= tx.run(query)
		for record in results:
			sink_calls.append(record['stmt'])
	
	return sink_calls


# def find_pdg_dependencies(session, decl):
# 	dep_ids = []
# 	identifier = decl.get('IdentifierName')
# 	with session.begin_transaction() as tx:
# 		# QUERY 2
# 		# get all objects that reach a variable declaration with specific name
# 		query = f"""
# 			MATCH
# 				(d:VariableDeclarator)-[:PDG*1..]->(x)
# 			WHERE d.IdentifierName = '{identifier}'
# 			RETURN *
# 		"""
# 		results= tx.run(query)
# 		for record in results:
# 			dep_ids.append(record['x'])

# 	return dep_ids


NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))
with neo_driver.session() as session:
	calls = find_sink_function_calls(session, 'eval')
	print(calls)
	# for c in calls:
	# 	deps = {
	# 		'VariableDeclarator': [],
	# 		'PDG_OBJECT': [],
	# 		'FunctionDeclaration': []
	# 	}

	# 	direct_deps = find_pdg_dependencies(session, c)
	# 	for d in direct_deps:
	# 		# print(d)
	# 		d_type = d.get('Type')
	# 		if d_type in deps:
	# 			deps[d_type].append(d)

	# 	print(deps)
		

# MATCH (c:CallExpression)-[:AST {RelationType: 'callee'}]->(e:Identifier {IdentifierName: 'eval'}),
# (call_decl:VariableDeclarator)-[:AST {RelationType: 'init'}]-(c:CallExpression)-[:AST {RelationType: 'arg'}]->(v_call),
# (v_decl:VariableDeclarator)<-[:PDG]-(call_decl)
# WHERE v_decl.IdentifierName = v_call.IdentifierName
# RETURN *