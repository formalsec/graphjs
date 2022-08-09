from neo4j import GraphDatabase
from queries.queries import Queries
import my_utils.utils as my_utils

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


NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	all_sinks = my_utils.get_all_sinks_from_config(config)
	my_utils.console(all_sinks, debug=False)

	calls = find_sink_function_calls(session, all_sinks)
	my_utils.console(calls, debug=False)

	all_sources = my_utils.get_all_sources_from_config(config)
	my_utils.console(all_sources, debug=False)

	params = find_source_objects_variables_and_functions(session, all_sources)
	my_utils.console(params, debug=False)

	param_types = find_source_objects_and_types(params, session)
	my_utils.console(param_types, debug=False)

	for query_type in Queries().get_query_types():
		paths = query_type.find_pdg_paths(session, params, calls)
		my_utils.console(paths, debug=False)

		if len(paths) > 0:
			results = query_type.validate_pdg_paths(paths, param_types)
			my_utils.console(results)
		else:
			print("No vulnerability detected for that source and sink")
