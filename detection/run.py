from neo4j import GraphDatabase
from queries.queries import Queries
import my_utils.utils as my_utils
from sys import argv

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	for query_type in Queries().get_query_types():
		vuln_paths = query_type.find_vulnerable_paths(session)

		if len(vuln_paths) > 0:
			print("{} vulnerability detected!".format(query_type.get_type()))
			my_utils.console(vuln_paths)
			my_utils.save_output(argv, vuln_paths, query_type.get_type(), True)
			# my_utils.save_output_multi_files(argv, vuln_paths)
		else:
			print("No vulnerability detected for type - {}".format(query_type.get_type()))
			my_utils.save_output(argv, vuln_paths, query_type.get_type(), False)
