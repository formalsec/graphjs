from . import structure_queries
from .my_utils import utils as my_utils
import json

from .query import Query


class Injection:
    def taint_query(self,session,identifier="",type=""):
        taint_query = f"""
            MATCH path = 
                (start)
                    -[path_edges:PDG*1..]
                        ->(sink:TAINT_SINK|PDG_RETURN|PDG_CALL)
                
            WHERE
                (start.IdentifierName = \"{identifier}\" OR start.Type=\"{type}\")
            
            OPTIONAL MATCH
                (start)
                    -[call_edges:PDG*1..]
                        ->(path_call:PDG_CALL)
                WHERE
                    LAST(call_edges) IN path_edges AND
                    (start.IdentifierName = \"{identifier}\" OR start.Type=\"{type}\")

            OPTIONAL MATCH
                (start)
                    -[other_call_edges:PDG*1..]
                        ->(other_call:PDG_CALL)
                WHERE
                    NOT other_call IN nodes(path) AND
                    (start.IdentifierName = \"{identifier}\" OR start.Type=\"{type}\")

            OPTIONAL MATCH  
                (start:TAINT_SOURCE)
                    -[param_edge:PDG]
                        ->(param:PDG_PARAM),

                (source_cfg)
                    -[param_ref:REF]
                        ->(param),

                (source_cfg)
                    -[:AST]
                        ->(source_ast)
                WHERE
                    param_edge.RelationType = "TAINT" AND
                    param_ref.RelationType = "param" AND
                    param in nodes(path)

            OPTIONAL MATCH  
                (sink_cfg)
                    -[:SINK]
                        ->(sink),

                (sink_cfg)
                    -[:AST]
                        ->(sink_ast)
            
            RETURN collect(LAST(call_edges)) as path_calls,source_cfg,source_ast,sink,sink_ast,path,sink_cfg,param;
        """

        return session.run(taint_query)
    
    
    
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

    


    def find(self,session,start):
        results = []
        vulnerable_paths = []
        if(start == "TAINT_SOURCE"):
            results = self.taint_query(session,type="TAINT_SOURCE")
        else:
            results = self.taint_query(session,identifier=start)

        for result in results:
            valid = True
            for call in result["path_calls"]:
                arg = call["RelationType"]
                arg = arg[arg.find("(")+1:arg.find(")")]
                if not arg in self.callInfo: # haven't checked this arg before
                    new_paths = self.find(session,arg) if arg != start else [] # avoid infinite recursion
                    vulnerable_paths += new_paths
                    _, ret_paths = self.filter_paths(new_paths)
                    if len(ret_paths) == 0:
                        valid = False
                        self.callInfo[arg] = False
                        break
                    else:
                        self.callInfo[arg] = True
                elif not self.callInfo[arg]: # cache tells that arg doens't propagate taint
                    valid = False
                    break
            
            if valid:
                vulnerable_paths.append(result)
        
        return vulnerable_paths


        


        
    def filter_paths(self, paths):
        sink_paths = list(filter(lambda path: path["sink"]["Type"] == "TAINT_SINK", paths))
        ret_paths = list(filter(lambda path: path["sink"]["Type"] == "PDG_RETURN", paths))
        return sink_paths, ret_paths


    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f'[INFO] Running injection query.')
        self.query.start_timer()
        results = self.find(session,"TAINT_SOURCE")
        sink_paths,_ = self.filter_paths(results)
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

