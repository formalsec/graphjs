import copy

from .query import Query, DetectionResult
from .interaction_protocol import interaction_protocol
from .my_utils import utils as my_utils
import json

from .intra_queries.proto_pollution import get_detection_results as intra_queries
from .bottom_up_greedy.proto_pollution import get_detection_results as bottom_up_greedy_queries


class PrototypePollution:

    def __init__(self, query: Query):
        self.query = query
    
    def find_vulnerable_paths(self, session, vuln_paths, source_file, filename: str, detection_output, query_type,
                              config):
        print(f"[INFO] Running prototype pollution query.")
        self.query.start_timer()
        detection_results: list[DetectionResult] = []
        
        orig_obj = None
        tainted_source = None
        # Run queries based on type
        if query_type == 'intra':
            results = intra_queries(session)
        elif query_type == 'bottom_up_greedy':
            results = bottom_up_greedy_queries(session, self.query)
        else:
            results = []
        
        for (result, orig_obj, tainted_source) in results:
            sink_raw_location = result["assignment_cfg"]["Location"]
            if sink_raw_location is not None:
                sink_location = json.loads(result["assignment_cfg"]["Location"])
                sink_lineno = sink_location["start"]["line"]
                file = sink_location["fname"]
                sink = my_utils.get_code_line_from_file(source_file, sink_lineno)
            else:
                sink_lineno = "?"
                sink = "?"
                file = filename
            vuln_path = {
                "filename": file,
                "vuln_type": "prototype-pollution",
                "sink": sink,
                "sink_lineno": sink_lineno,
                "sink_function": result["assignment_cfg"]["Id"]
            }
            my_utils.save_intermediate_output(vuln_path, detection_output)
            if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                vuln_paths.append(vuln_path)
            elif self.query.reconstruct_types and not exists_vuln_path(detection_results, vuln_path):
                detection_result: DetectionResult = copy.deepcopy(vuln_path)
                detection_result["polluted_obj"] = orig_obj
                detection_result["polluting_value"] = tainted_source
                detection_results.append(detection_result)
        self.query.time_detection("proto_pollution")

        if self.query.reconstruct_types:
            print(f'[INFO] Prototype Pollution - Reconstructing attacker-controlled data.')
            for detection_result in detection_results:
                detection_objs = interaction_protocol.get_vulnerability_info(session, detection_result, source_file, config)

                for detection_obj in detection_objs:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)

            self.query.time_reconstruction("proto_pollution")

        return vuln_paths


def exists_vuln_path(detection_results: list[DetectionResult], path) -> bool:
    for detection_result in detection_results:
        if path["filename"] == detection_result["filename"] and \
                path["vuln_type"] == detection_result["vuln_type"] and \
                path["sink"] == detection_result["sink"] and \
                path["sink_lineno"] == detection_result["sink_lineno"] and \
                path["sink_function"] == detection_result["sink_function"]:
            return True
    return False
