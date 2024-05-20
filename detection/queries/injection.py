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

        taint_query = f"""
            MATCH
                (func:VariableDeclarator)
                    -[ref_edge:REF]
                        ->(param:PDG_OBJECT)
                            -[edges:PDG*1..]
                                ->(sink:TAINT_SINK),

                (sink_cfg)
					-[:SINK]
						->(sink),

				(sink_cfg)
					-[:AST]
						->(sink_ast)

                WHERE
                    ref_edge.RelationType = "param" AND
                    ALL(
							edge in edges WHERE
							NOT edge.RelationType = "ARG" OR
							edge.valid = true
                    )
            RETURN *
            """
        
        sink_paths = session.run(taint_query)

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in sink_paths:
 
            if self.query.confirm_vulnerability(session,record["func"]["Id"],record["param"]):
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
        self.query.time_detection("injection")

        # Run template query
        '''
        results = session.run(self.template_query)
        for record in results:
            print(record)
        '''

        return vuln_paths

