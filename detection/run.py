from neo4j import GraphDatabase
from queries.queries import Queries
import my_utils.utils as my_utils
import argparse
from sys import argv

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

parser = argparse.ArgumentParser()
parser.add_argument("-f", "--file", type=str, required=True,
					help="Path to the file being tested.")
parser.add_argument("-o", "--output", type=str, default="taint_summary.json",
					help="Taint summary output file.")
args = parser.parse_args()

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:
	vuln_paths = []
	# Optimization: Data reconstruction takes some time, by using this data structure, the same data is only constructed once
	attacker_controlled_data = {}
	for query_type in Queries().get_query_types():
		query_type.find_vulnerable_paths(session, vuln_paths, attacker_controlled_data, args.file, config)

	if len(vuln_paths) > 0:
		my_utils.console(vuln_paths)
		my_utils.save_output(vuln_paths, args.output)
	else:
		print("No vulnerabilities detected.")
		my_utils.save_output(vuln_paths, args.output)
