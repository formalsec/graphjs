from . import structure_queries
from .my_utils import utils as my_utils
import json

from .query import Query


class Injection:
    
    template_query = f"""
        MATCH
           ...
        WHERE
            ...
        RETURN *
    """


    # cache the taint propagation information
    callInfo = {}

    def __init__(self, query: Query):
        self.query = query


    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f'[INFO] Running injection query.')
        self.query.start_timer()
        self.query.reset_call_info()
        sink_paths,_ = self.query.find_taint_paths(session,"TAINT_SOURCE")
        detection_results = []

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in sink_paths:
                sink_name = record["sink"]["IdentifierName"]
                json_info = json.loads(record["sink_ast"]["Location"])
                sink_lineno = json_info["start"]["line"]
                file = json_info["fname"]
                sink = my_utils.get_code_line_from_file(file, sink_lineno)
                vuln_path = {
                    "vuln_type": my_utils.get_injection_type(sink_name, config),
                    "file": file,
                    "sink": sink,
                    "sink_lineno": sink_lineno,
                }
                my_utils.save_intermediate_output(vuln_path, detection_output)
                if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                    vuln_paths.append(vuln_path)
                else:
                    source_lineno = json.loads(record["source_ast"]["Location"])["start"]["line"]
                    detection_results.append(
                        {
                            "vuln_type": my_utils.get_injection_type(sink_name, config),
                            "sink_obj": record["sink_cfg"],
                            "sink_lineno": sink_lineno,
                            "source_lineno": source_lineno,
                            "sink_name": sink_name})
        self.query.time_detection("injection")

        # Run template query
        '''
        results = session.run(self.template_query)
        for record in results:
            print(record)
        '''
        if self.query.reconstruct_types:
            print(f'[INFO] Reconstructing attacker-controlled data.')
            for detection_result in detection_results:
                detection_objs = structure_queries.get_source(
                    session, detection_result["sink_obj"], detection_result["sink_lineno"],
                    detection_result["source_lineno"], detection_result["sink_name"],
                    detection_result["vuln_type"], config)

                for detection_obj in detection_objs:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)
            self.query.time_reconstruction("injection")

        return vuln_paths

