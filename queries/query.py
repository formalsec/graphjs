import re
from neo4j import GraphDatabase
import json

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

		for sink in sinks:
			sink_func = sink['function'].get('Id')
			sink_id = sink['sink'].get('Id')

			if source_func == sink_func:
				print("Testing path between:")
				print("\tsource - ", source_obj_id, ", and sink - ", sink_id)
				with session.begin_transaction() as tx:
					# QUERY 3
					# get (function, parameter) pairs that we consider source
					query = f"""
						MATCH
							(v:VariableDeclarator)-[:AST]->(f:FunctionExpression)-[:AST]->(param),
							path=(param)-[create:PDG]->(source)-[:PDG*1..]->(sink)
						WHERE
							f.Id = '{source_func}' AND
							create.RelationType = 'CREATE' AND
							source.Id = '{source_obj_id}' AND
							sink.Id = '{sink_id}'
						RETURN *
					"""
					results = tx.run(query)

					if results.peek():
						record = results.single()
						path = record["path"]
						func = record["v"]["IdentifierName"]
						tainted_paths.append({
							"path": path,
							"func": func,
							"sink": sink['sinkName'],
							"ends": (source_obj_id, sink_id)
						})

	return tainted_paths


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
		# detected vulnerability
		for p in paths:
			path = p["path"]
			ends = p["ends"]
			locs = set()
			for edge in path:
				firstNode = edge.nodes[0]
				if firstNode["Location"]:
					location = json.loads(firstNode["Location"])
					locs.add(location["start"]["line"])

				secondNode = edge.nodes[1]
				if secondNode["Location"]:
					location = json.loads(secondNode["Location"])
					locs.add(location["start"]["line"])
			print("Detected vulnerability in the following (source, sink) pair nodes: ", ends)

			pResult = {}
			pResult["sink"] = p["sink"]
			pResult["function"] = p["func"]
			pResult["params"] = []
			pResult["lines"] = list(locs)
			print(pResult)
	else:
		print("No vulnerability detected for that source and sink")