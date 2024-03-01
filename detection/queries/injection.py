from . import structure_queries
from .my_utils import utils as my_utils
import json

from .query import Query


class Injection:
    main_query = f"""
        MATCH path = 
            (source:TAINT_SOURCE)
                -[param_edge:PDG]
                    ->(param:PDG_PARAM)
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
        RETURN path,sink,sink_ast,source_ast,sink_cfg,source_cfg;
    """

    template_query = f"""
        MATCH
           ...
        WHERE
            ...
        RETURN *
    """

    # Map path -> ([calling paths],propagates taint = boolean)
    callInfo = {}

    def __init__(self, query: Query):
        self.query = query

    def validate_result(self,path,session):

        propagates = True
        vuln_records_list = []
        for index,node in enumerate(path.nodes):
            if node['Type'] == 'PDG_CALL':  
                paramName = path.relationships[index-1]['RelationType']
                callName = paramName[paramName.find('(')+1:paramName.find(')')]

                if callName in self.callInfo:
                    propagates = self.callInfo[callName] and propagates

                else:

                    
                    split = callName.split('.')
                    paramName = split[-2] + '.' + split[-1]
                    funcName = split[-3]
                    result,vuln_records = self.check_taint_propagation(funcName,paramName,session)
                    propagates = result and propagates
                    self.callInfo[callName] = result
                    vuln_records_list += vuln_records
            
            if not propagates:
                break


        return propagates, vuln_records_list
            
    def check_taint_propagation(self, funcName,paramName,session):
        taint_propagation_query = f"""
            MATCH path = 
                (func:VariableDeclarator)
                    -[:REF]
                        ->(param:PDG_PARAM)
                            -[pdg_edges:PDG*1..]
                                ->(sink:TAINT_SINK|PDG_RETURN|PDG_CALL)
            WHERE
                func.IdentifierName = \"{funcName}\" AND
                param.IdentifierName = \"{paramName}\"

            OPTIONAL MATCH (sink_cfg)
                    -[:SINK]
                        ->(sink)

            OPTIONAL MATCH (sink_cfg)
                    -[:AST]
                        ->(sink_ast)
            RETURN path,sink,sink_ast,sink_cfg,func;
        """

        results = session.run(taint_propagation_query)
        propagates = False
        vuln_records_list = []
        
        for record in results:
            result, vuln_records = self.validate_result(record['path'],session)

            if(record['sink']['Type'] == 'PDG_RETURN'):
                propagates = result
            elif record['sink']['Type'] == 'TAINT_SINK':
                vuln_records_list.append(record)

            vuln_records_list += vuln_records

        return propagates, vuln_records_list
        
        

    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f'[INFO] Running injection query.')
        self.query.start_timer()
        results = session.run(self.main_query)
        detection_results = []

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in results:
            valid_vuln,vuln_records = self.validate_result(record['path'],session) 

            if(valid_vuln):
                vuln_records.append(record)

            for vuln_record in vuln_records:
                sink_name = vuln_record["sink"]["IdentifierName"]
                sink_lineno = json.loads(vuln_record["sink_ast"]["Location"])["start"]["line"]
                sink = my_utils.get_code_line_from_file(vuln_file, sink_lineno)
                vuln_path = {
                    "vuln_type": my_utils.get_injection_type(sink_name, config),
                    "sink": sink,
                    "sink_lineno": sink_lineno,
                }
                my_utils.save_intermediate_output(vuln_path, detection_output)
                if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                    vuln_paths.append(vuln_path)
                else:
                    source_ast = record["source_ast"]
                    source_lineno = json.loads(source_ast["Location"])["start"]["line"]
                    detection_results.append(
                        {
                            "vuln_type": my_utils.get_injection_type(sink_name, config),
                            "sink_obj": vuln_record["sink_cfg"],
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

