from neo4j import GraphDatabase
import neo4j.exceptions
import os
import sys

from .queries.query import Query
from .queries.my_utils import utils
from .neo4j_import.utils import neo4j_constants as constants
from .queries.injection import Injection
from .queries.proto_pollution import PrototypePollution


def traverse_graph(normalized_file, taint_summary_output, time_output_file, reconstruct_types=False, bolt_port=7687):
    neo4j_connection_string = "bolt://127.0.0.1:" + str(bolt_port)
    config = utils.read_config()
    detection_file_name = f'{os.path.splitext(os.path.basename(taint_summary_output))[0]}_detection.json'
    detection_output = os.path.join(os.path.dirname(taint_summary_output), detection_file_name)
    utils.init_intermediate_output(detection_output)

    with GraphDatabase.driver(neo4j_connection_string, auth=(constants.NEO4J_USER, constants.NEO4J_PASSWORD)) as driver:
        try:
            driver.verify_connectivity()
            session = driver.session()
        except neo4j.exceptions.Neo4jError:
            sys.exit("Unable to connect to Neo4j instance.")

        vulnerable_paths = []

        query = Query(reconstruct_types, time_output_file)

        query.process_cg(session)
        query_types = [Injection(query), PrototypePollution(query)]
        for query_type in query_types:
            query_type.find_vulnerable_paths(session, vulnerable_paths, normalized_file, detection_output, config)

        if len(vulnerable_paths) > 0:
            print(f'[INFO] Detected {len(vulnerable_paths)} vulnerabilities.')
            utils.save_output(vulnerable_paths, taint_summary_output)
        else:
            print(f'[INFO] No vulnerabilities detected.')
            utils.save_output(vulnerable_paths, taint_summary_output)
