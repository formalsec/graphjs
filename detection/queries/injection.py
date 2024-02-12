from .query_type import QueryType
from . import structure_queries
from .my_utils import utils as my_utils
import json
import time


class Injection(QueryType):
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
                    ->(sink)
        WHERE
            param_edge.RelationType = "TAINT" AND
            param_ref.RelationType = "param"
        RETURN *
    """

    def __init__(self, reconstruct_types=False):
        QueryType.__init__(self, "Injection")
        self.time_output = None
        self.start_time = None
        self.reconstruct_types = reconstruct_types

    def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, detection_output, time_output, config):
        """
        Find injection vulnerabilities paths.
        """
        print(f'[INFO] Running injection query.')
        self.time_output = time_output
        self.start_timer()  # start timer
        results = session.run(self.injection_query)
        detection_results = []

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in results:
            sink_name = record["sink"]["IdentifierName"]
            source_cfg = record["source_cfg"]
            source_ast = record["source_ast"]
            source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
            sink_lineno = json.loads(record["sink_cfg"]["Location"])["start"]["line"]
            param_name = my_utils.format_name(record["param"]["IdentifierName"])
            vuln_path = {
                "vuln_type": my_utils.get_injection_type(sink_name, config),
                "source": source_cfg["IdentifierName"] if source_ast["Type"] == "FunctionExpression" or source_ast[
                    "Type"] == "ArrowFunctionExpression" else param_name,
                "source_lineno": source_lineno,
                "sink": sink_name,
                "sink_lineno": sink_lineno,
            }
            my_utils.save_intermediate_output(vuln_path, detection_output)
            detection_results.append(
                {
                    "vuln_type": my_utils.get_injection_type(sink_name, config),
                    "sink_obj": record["sink_cfg"],
                    "sink_lineno": sink_lineno,
                    "source_lineno": source_lineno,
                    "sink_name": sink_name})
        self.time_detection()  # time injection

        if self.reconstruct_types:
            print(f'[INFO] Reconstructing attacker-controlled data.')
            for detection_result in detection_results:
                detection_objs = structure_queries.get_source(
                    session, detection_result["sink_obj"], detection_result["sink_lineno"],
                    detection_result["source_lineno"], detection_result["sink_name"],
                    detection_result["vuln_type"], config)

                for detection_obj in detection_objs:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)
        self.time_reconstruction()
        return vuln_paths

    # Timer related functions
    def start_timer(self):
        self.start_time = time.time()

    def time_detection(self):
        injection_detection_time = (time.time() - self.start_time) * 1000  # to ms
        print(f'injection_detection: {injection_detection_time}', file=open(self.time_output, 'a'))  # output to file
        self.start_timer()

    def time_reconstruction(self):
        reconstruction_detection_time = (time.time() - self.start_time) * 1000  # to ms
        print(f'injection_reconstruction: {reconstruction_detection_time}', file=open(self.time_output, 'a'))  # output to file
