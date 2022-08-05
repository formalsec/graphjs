from os import path
from neo4j import GraphDatabase
import json
from pprint import pprint

def find_sink_function_calls(session, sinks):
	sink_calls = []
	with session.begin_transaction() as tx:
		# QUERY 1
		# get (function, sink statement) pair that holds the call to a sink
		query = f"""
			WITH {sinks} as SINKS
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


def find_source_objects_and_types(params, session):
	paramTypes = {}

	for p in params:
		funcName = p['functionName']
		paramName = p['param'].get('IdentifierName')
		paramObjId = p['param_obj'].get('Id')
		paramProperties = []

		with session.begin_transaction() as tx:
			# QUERY 2
			# get (function, parameter) pairs that we consider source
			query = f"""
				MATCH
					(obj:PDG_OBJECT)-[lookup:PDG]->(s)
				WHERE
					obj.Id = '{paramObjId}' AND
					lookup.RelationType = 'LOOKUP'
				RETURN *
			"""
			results = tx.run(query)
			for record in results:
				paramProperties.append({
					'prop_name': record['lookup'].get('IdentifierName')
				})

		if not funcName in paramTypes:
			paramTypes[funcName] = []

		if len(paramProperties) > 0:
			data = {
				'var': paramName,
				'properties': paramProperties,
			}
		else:
			data = {
				'var': paramName
			}
		paramTypes[funcName].append(data)

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
				'param': record['p'],
				'param_obj': record['obj']
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
				'param': record['stmt'],
				'param_obj': record['obj']
			})
	return sources_list


def find_source_objects_variables_and_functions(session, sources):
	params = find_params(session)
	other_sources = find_other_sources(session, sources)
	params.extend(other_sources)
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


def validate_pdg_paths(paths, param_types):
	results = []
    # detected vulnerability
	valid_paths = {}
	for p in paths:
		locs = set()
		func = p['func']
		sink = p['sink']
		pdg_path = p["pdg_path"]
		cfg_path = p["cfg_path"]

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
		params.append(param)
		# verify that param is in pdg path

		for edge in pdg_path:
			firstNodeName = edge.nodes[0]["IdentifierName"]
			secondNodeName = edge.nodes[1]["IdentifierName"]

			if firstNodeName == param or secondNodeName == param:

				flow = {
					"sink": sink,
					"lines": list(locs),
				}

				if func in valid_paths:
					valid_paths[func]["flow"].append(flow)
				else:
					pResult = {}
					pResult["function"] = func
					pResult["params"] = param_types[func]
					pResult["flows"] = [ flow ]
					valid_paths[func] = pResult

	return list(valid_paths.values())


def console(s, debug=True):
	if debug:
		try:
			print(json.dumps(s, indent=4))
		except:
			pprint(s)


def read_config():
	file_path = path.realpath(path.dirname(__file__))
	config_path = path.join(file_path, "config.json")
	with open(config_path, "r") as configFile:
		return json.load(configFile)


def get_all_sinks_from_config(config):
	sinks = []
	if "sinks" in config:
		vuln_types = config["sinks"]
		for vuln in vuln_types:
			sinks.extend(vuln_types[vuln])
	else:
		raise Exception("Config file is missing the sinks")
	return sinks


def get_all_sources_from_config(config):
	if "sources" in config:
		return config["sources"]
	else:
		raise Exception("Config file is missing the sources")


NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

config = read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	all_sinks = get_all_sinks_from_config(config)
	console(all_sinks, debug=False)

	calls = find_sink_function_calls(session, all_sinks)
	console(calls, debug=False)

	all_sources = get_all_sources_from_config(config)
	console(all_sources, debug=False)

	params = find_source_objects_variables_and_functions(session, all_sources)
	console(params, debug=True)

	param_types = find_source_objects_and_types(params, session)
	console(param_types, debug=False)

	paths = find_pdg_paths(session, params, calls)
	console(paths, debug=False)

	if len(paths) > 0:
		results = validate_pdg_paths(paths, param_types)
		console(results)
	else:
		print("No vulnerability detected for that source and sink")
