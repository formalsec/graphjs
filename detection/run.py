from ast import arg
from neo4j import GraphDatabase
from queries.queries import Queries
from queries.find_functions import *
import my_utils.utils as my_utils
from sys import argv
import json

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	all_sinks = my_utils.get_all_sinks_from_config(config)
	my_utils.console(all_sinks, debug=False)

	sinks = find_sink_function_calls(session, all_sinks)
	my_utils.console(sinks, debug=False)

	all_sources = my_utils.get_all_sources_from_config(config)
	my_utils.console(all_sources, debug=False)

	sources = find_source_objects_variables_and_functions(session, all_sources)
	my_utils.console(sources, debug=False)

	param_types = find_param_objects_and_types(sources, session)
	my_utils.console(param_types, debug=False)

	for query_type in Queries().get_query_types():
		paths = query_type.find_pdg_paths(session, sources, sinks)
		my_utils.console(paths, debug=False)

		results = query_type.validate_pdg_paths(paths, param_types, session)
		if len(results) > 0:
			print("{} vulnerability detected!".format(query_type.get_type()))
			my_utils.console(results)
			my_utils.save_output(argv, results, query_type.get_type(), True)
		else:
			print("No vulnerability detected for type - {}".format(query_type.get_type()))
			my_utils.save_output(argv, results, query_type.get_type(), False)
