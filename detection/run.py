from neo4j import GraphDatabase
import neo4j.exceptions
import os
import sys
import time

from .queries.query import Query
from .queries.my_utils import utils
from .neo4j_import.utils import neo4j_constants as constants
from .queries.injection import Injection
from .queries.proto_pollution import PrototypePollution

max_connection_tries = 3


def traverse_graph(source_file, taint_summary_output, time_output_file, query_type, reconstruct_types=False,
                   bolt_port=7687):
    neo4j_connection_string = "bolt://127.0.0.1:" + str(bolt_port)
    config = utils.read_config()
    detection_file_name = f'{os.path.splitext(os.path.basename(taint_summary_output))[0]}_detection.json'
    detection_output = os.path.join(os.path.dirname(taint_summary_output), detection_file_name)
    utils.init_intermediate_output(detection_output)
    # Path of the source file, relative to the location of the taint summary
    relative_filepath = str(os.path.relpath(source_file, os.path.dirname(taint_summary_output)))

    with GraphDatabase.driver(neo4j_connection_string, auth=(constants.NEO4J_USER, constants.NEO4J_PASSWORD)) as driver:
        nr_tries = 0
        while nr_tries < max_connection_tries:
            try:
                driver.verify_connectivity()
                break
            except neo4j.exceptions.Neo4jError as e:
                print(f"Unable to connect to Neo4j instance. Trying again: {e.code}")
                nr_tries += 1
                time.sleep(30)

        if nr_tries == max_connection_tries:
            sys.exit(f"Unable to connect to Neo4j instance: Max tries.")

        session = driver.session()
        vulnerable_paths = []

        query = Query(reconstruct_types, time_output_file)

        query.process_cg(session)
        query_types = [Injection(query), PrototypePollution(query)]
        for q in query_types:
            q.find_vulnerable_paths(session, vulnerable_paths, source_file, relative_filepath,
                                    detection_output, query_type, config)

        if len(vulnerable_paths) > 0:
            print(f'[INFO] Detected {len(vulnerable_paths)} vulnerabilities.')
            utils.save_output(vulnerable_paths, taint_summary_output)
        else:
            print(f'[INFO] No vulnerabilities detected.')
            utils.save_output(vulnerable_paths, taint_summary_output)
