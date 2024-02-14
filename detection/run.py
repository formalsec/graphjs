from neo4j import GraphDatabase
import os
import sys
from .queries.queries import Queries
from .queries.my_utils import utils

from dotenv import load_dotenv
load_dotenv()


def traverse_graph(normalized_file, taint_summary_output, time_output_file, reconstruct_types=False, bolt_port=7687):
    neo4j_connection_string = "bolt://127.0.0.1:" + str(bolt_port)
    config = utils.read_config()
    detection_file_name = (
        f'''{os.path.splitext(os.path.basename(taint_summary_output))[0]}_detection{os.path.splitext(os.path.basename(taint_summary_output))[1]}''')
    detection_output = os.path.join(os.path.dirname(taint_summary_output), detection_file_name)
    utils.init_intermediate_output(detection_output)

    with GraphDatabase.driver(neo4j_connection_string, auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))) as driver:
        try:
            driver.verify_connectivity()
            session = driver.session()
        except:
            sys.exit("Unable to connect to Neo4j instance.")

        vuln_paths = []
        # Optimization: Data reconstruction takes some time, by using this data structure, the same data is only
        # constructed once
        attacker_controlled_data = {}
        for query_type in Queries(reconstruct_types).get_query_types():
            query_type.find_vulnerable_paths(session, vuln_paths, attacker_controlled_data,
                                             normalized_file, detection_output, time_output_file, config)
        if len(vuln_paths) > 0:
            print(f'[INFO] Detected {len(vuln_paths)} vulnerabilities.')
            utils.save_output(vuln_paths, taint_summary_output)
        else:
            print(f'[INFO] No vulnerabilities detected.')
            utils.save_output(vuln_paths, taint_summary_output)
