from neo4j import GraphDatabase
from queries.queries import Queries
import my_utils.utils as my_utils
import argparse
import os

THIS_SCRIPT_NAME: str = os.path.basename(__file__)

parser = argparse.ArgumentParser()
parser.add_argument(
		"-f",
		"--normalized_file",
		type=str,
		required=True,
		help="Path to the normalized version of the file being tested.")
parser.add_argument(
		"-o",
		"--output",
		type=str,
		default="taint_summary.json",
		help="Taint summary output file.")
parser.add_argument(
		"-b",
		"--bolt-port",
		type=str,
		default="7687",
		help="Target Neo4j container bolt port.")

args = parser.parse_args()

NEO4J_CONN_STRING = "bolt://127.0.0.1:" + args.bolt_port

config = my_utils.read_config()
neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))
detection_file_name = (
	f"{os.path.splitext(os.path.basename(args.output))[0]}_detection{os.path.splitext(os.path.basename(args.output))[1]}")
detection_output = os.path.join(os.path.dirname(args.output), detection_file_name)

with neo_driver.session() as session:
	vuln_paths = []
	# Optimization: Data reconstruction takes some time, by using this data structure, the same data is only
	# constructed once
	attacker_controlled_data = {}
	for query_type in Queries().get_query_types():
		query_type.find_vulnerable_paths(
				session,
				vuln_paths,
				attacker_controlled_data,
				args.normalized_file,
				detection_output,
				config)
	if len(vuln_paths) > 0:
		print(f'[INFO][{THIS_SCRIPT_NAME}] - Detected {len(vuln_paths)} vulnerabilities.')
		my_utils.save_output(vuln_paths, args.output)
	else:
		print(f'[INFO][{THIS_SCRIPT_NAME}] - No vulnerabilities detected.')
		my_utils.save_output(vuln_paths, args.output)
		my_utils.init_intermediate_output(detection_output)

neo_driver.close()
