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
                            ->(sink:TAINT_SINK|PDG_CALL),
            (source_cfg)
                -[param_ref:REF]
                    ->(param),
            (source_cfg)
                -[:AST]
                    ->(source_ast)
        WHERE
            param_edge.RelationType = "TAINT" AND
            param_ref.RelationType = "param"

        OPTIONAL MATCH  
            (sink_cfg)
                -[:SINK]
                    ->(sink)

        OPTIONAL MATCH 
               (sink_cfg)
                -[:AST]
                    ->(sink_ast)
        WITH [node IN nodes(path) WHERE node.Type = "PDG_CALL"] AS calls,
        source, source_cfg,source_ast, sink, sink_ast,path,sink_cfg,param
        RETURN *;
    """

    def find_called_func(self,session,callNodeId):
        query = f"""
             MATCH
                (callNode:PDG_CALL)
                    -[:CG]
                        ->(func:VariableDeclarator)
            WHERE
                callNode.Id = \"{callNodeId}\"
            RETURN *;
        """
        results = session.run(query)
        for record in results:
            return record["func"]["Id"]
        

    def check_taint_propagation(self,session,funcId,paramName):
        taint_propagation_query = f"""
            MATCH path = 
                (source_cfg:VariableDeclarator)
                    -[:REF]
                        ->(param:PDG_PARAM)
                            -[pdg_edges:PDG*1..]
                                ->(sink:TAINT_SINK|PDG_RETURN|PDG_CALL)
            WHERE
                source_cfg.Id = \"{funcId}\" AND
                param.IdentifierName = \"{paramName}\"

            OPTIONAL MATCH (sink_cfg)
                    -[:SINK]
                        ->(sink)

            OPTIONAL MATCH (sink_cfg)
                    -[:AST]
                        ->(sink_ast)
            WITH [node IN nodes(path) WHERE node.Type = "PDG_CALL"] AS calls,
                path,sink,sink_ast,sink_cfg,param, source_cfg
            RETURN *;
        """

        results = session.run(taint_propagation_query)
        propagates  = False
        returnPath = None
        vulnRecords = []
        for record in results:

            if(record["sink"]["Type"] == "PDG_RETURN"):
                # we only consider that the taint propagates if there are no calls in the path (else the path needs to be checked)
                propagates = True if record["calls"] == [] else None
                returnPath = record
            else: # store any sinks found in the call
                vulnRecords.append(record)

        return returnPath,propagates,vulnRecords


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

    def validate_path(self,session,targetRecord):
        stack = [(targetRecord,True,targetRecord["source_cfg"]["Id"],targetRecord["param"]["IdentifierName"])]
        vulnRecords = []
        checked = set() # represents the calls that have already been checked (the recursive calls can be checked)
        while stack != []:
            record,valid,currId,currArg = stack[-1]
            calls,path = record["calls"],record["path"]
            done = True
            for call in calls: # for a path to be vulnerable all the calls must propagate taint

                # get both the function being called and the argument in question
                id = self.find_called_func(session,call["Id"])
                argEdge = next(filter(lambda r: r.end_node == call, path.relationships))["RelationType"]
                arg = argEdge[argEdge.find("(")+1:argEdge.find(")")]

                if id in self.callInfo and arg in self.callInfo[id]: # if the information is cached just use it
                    valid = valid and self.callInfo[id][arg]

                elif (id,arg) in checked:
                    continue

                else: # else we need to check the taint propagation
                    if not id in self.callInfo:
                        self.callInfo[id] = {}

                    returnRecord,propagates,newVulnRecords = self.check_taint_propagation(session,id,arg)
                    vulnRecords += newVulnRecords
                    if returnRecord and returnRecord["calls"] != []: # if the function calls other functions we need to check it
                        stack.append((returnRecord,True,id,arg))
                        done = False
                    else:
                        valid = valid and propagates
                        self.callInfo[id][arg] = propagates
                    checked.add((id,arg))

            if done:
                stack.pop()

                if record == targetRecord:
                    return valid,vulnRecords
                else:
                    self.callInfo[currId][currArg] = valid


        
        

    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f'[INFO] Running injection query.')
        self.query.start_timer()
        results = session.run(self.main_query)
        detection_results = []

        print(f'[INFO] Injection - Analyzing detected vulnerabilities.')
        for record in results:
            vuln_records = []

            # the query returns a path for each sink, we need to check if the taint propagates through all the calls
            records_to_verify= [record]
            while records_to_verify != []:
                record = records_to_verify.pop()

                valid,moreRecords = self.validate_path(session,record)
                if valid and record["sink"]["Type"] == "TAINT_SINK": # calls are being treated as sinks, we need to ignore them
                    vuln_records.append(record)
                # some new paths can be found while checking the taint propagation
                records_to_verify += moreRecords

            for vuln_record in vuln_records:
                sink_name = vuln_record["sink"]["IdentifierName"]
                json_info = json.loads(vuln_record["sink_ast"]["Location"])
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

