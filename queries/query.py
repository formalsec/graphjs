from neo4j import GraphDatabase
import json

def find_sink_function_calls(session, sink):
	sink_calls = []
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			MATCH
				(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST*1..]-(stmt:VariableDeclarator)-[init:AST]-(c:CallExpression)-[callee:AST]->(e:Identifier)
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
				'functionName': record['v']['IdentifierName'],
				'sink': record['stmt'],
				'sinkName': sink,
			})

	return sink_calls


def find_source_objects_and_variables(session):
	params = []
	with session.begin_transaction() as tx:
		# QUERY 2
		# get (function, parameter) pairs that we consider source
		query = f"""
			MATCH
				(f:FunctionExpression)-[param:AST]-(p:Identifier)-[create:PDG]->(obj:PDG_OBJECT)
			WHERE
				param.RelationType = 'param' AND
				create.IdentifierName = p.IdentifierName
			RETURN *
		"""
		results = tx.run(query)
		for record in results:
			params.append({
				'function': record['f'],
				'param': record['p'],
				'param_obj': record['obj']
			})
	return params


def find_pdg_paths(session, sources, sinks):
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


def validate_pdg_paths(paths):
	results = []
    # detected vulnerability
	for p in paths:
		pdg_path = p["pdg_path"]
		cfg_path = p["cfg_path"]
		locs = set()

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
		valid_path = False
		# verify that param is in pdg path

		for edge in pdg_path:
			firstNodeName = edge.nodes[0]["IdentifierName"]
			secondNodeName = edge.nodes[1]["IdentifierName"]

			if firstNodeName == param or secondNodeName == param:
				valid_path = True

		if valid_path:
			pResult = {}
			pResult["function"] = p["func"]
			pResult["param"] = param
			pResult["sink"] = p["sink"]
			pResult["lines"] = list(locs)
			results.append(pResult)

	return results


NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	calls = find_sink_function_calls(session, 'eval')
	# for c in calls:
	# 	print(c)

	params = find_source_objects_and_variables(session)
	# for p in params:
	# 	print(p)

	paths = find_pdg_paths(session, params, calls)

	if len(paths) > 0:
		results = validate_pdg_paths(paths)
		print(json.dumps(results, indent=4))
	else:
		print("No vulnerability detected for that source and sink")
