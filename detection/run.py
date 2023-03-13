from neo4j import GraphDatabase
from queries.queries import Queries
import my_utils.utils as my_utils
from sys import argv

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

if len(argv) < 2:
	print("Please provide the path to the file being tested!")
	exit(0)	

with neo_driver.session() as session:
	vuln_paths = []
	for query_type in Queries().get_query_types():
		query_type.find_vulnerable_paths(session, vuln_paths)

	if len(vuln_paths) > 0:
		my_utils.console(vuln_paths)
		my_utils.save_output(vuln_paths)
	else:
		print("No vulnerabilities detected.")
		my_utils.save_output(vuln_paths)
