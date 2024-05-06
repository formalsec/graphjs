from typing import Dict, Any, Tuple

from . import structure_queries
from .my_utils import utils as my_utils
import json

from .query import Query


class Injection:
    injection_query = f"""
        MATCH
            (source:TAINT_SOURCE)
                -[param_edge:PDG]
                    ->(param:PDG_OBJECT)
                        -[pdg_edges:PDG*1..]
                            ->(sink:TAINT_SINK),
            (source_cfg)
                -[param_ref:REF]
                    ->(param),
            (source_cfg)
                -[:AST]
                    ->(source_ast),
            (sink_cfg)
                -[:SINK]
                    ->(sink),
            (sink_cfg)
                -[:AST]
                    ->(sink_ast)
        WHERE
            param_edge.RelationType = "TAINT" AND
            param_ref.RelationType = "param"
        RETURN *
    """

    template_query = f"""
        MATCH
           ...
        WHERE
            ...
        RETURN *
    """

    def __init__(self, query: Query):
        self.query = query

    def find_vulnerable_paths(self, session, vuln_paths, source_file, filename: str, detection_output, config):
        print(f'[INFO] Running injection query.')
        self.query.start_timer()
        results = session.run(self.injection_query)
        detection_results = []

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in results:
            sink_name = record["sink"]["IdentifierName"]
            sink_lineno = json.loads(record["sink_ast"]["Location"])["start"]["line"]
            sink = my_utils.get_code_line_from_file(source_file, sink_lineno)
            vuln_type: str = my_utils.get_injection_type(sink_name, config)
            vuln_path = {
                "filename": filename,
                "vuln_type": vuln_type,
                "sink": sink,
                "sink_lineno": sink_lineno,
                "sink_function": record["sink_cfg"]["Id"]
            }
            my_utils.save_intermediate_output(vuln_path, detection_output)
            if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                vuln_paths.append(vuln_path)
            elif self.query.reconstruct_types:
                detection_results.append(vuln_path)
        self.query.time_detection("injection")

        if self.query.reconstruct_types:
            print(f'[INFO] Reconstructing attacker-controlled data.')
            for detection_result in detection_results:
                vulnerabilities = structure_queries.get_vulnerability_info(session, detection_result, config)
                for detection_obj in vulnerabilities:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)
            self.query.time_reconstruction("injection")

        return vuln_paths

