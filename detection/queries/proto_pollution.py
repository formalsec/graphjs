from .query import Query
from . import structure_queries
from .my_utils import utils as my_utils
import json


def check_taint_key(first_lookup_obj):
    return f"""
        MATCH
            (source:TAINT_SOURCE)
                -[key_taint:PDG]
                    ->(key:PDG_OBJECT)
                        -[tainted_key_path:PDG*1..]
                            ->(sub_obj)
        WHERE
            sub_obj.Id = \"{first_lookup_obj}\" AND
            key_taint.RelationType = "TAINT" AND
            ALL(edge IN tainted_key_path WHERE
                edge.RelationType = "SO" OR
                edge.RelationType = "ARG" OR
                edge.RelationType = "DEP")
        RETURN DISTINCT source
    """


def check_tainted_assignment(assignment_obj):
    return f"""
        MATCH
            (source)
                -[subKey_taint:PDG]
                    ->(subKey:PDG_OBJECT)
                        -[tainted_subKey_path:PDG*1..]
                            ->(nv_sub_obj)
        WHERE
            nv_sub_obj.Id = \"{assignment_obj}\" AND
            subKey_taint.RelationType = "TAINT" AND
            ALL(edge IN tainted_subKey_path WHERE
                edge.RelationType = "SO" OR
                edge.RelationType = "ARG" OR
                edge.RelationType = "DEP")
        RETURN distinct source
    """


def check_taint_sub_key(second_lookup_obj):
    return f"""
    MATCH
        (source)
            -[value_taint:PDG]
                ->(value:PDG_OBJECT)
                    -[tainted_value_path:PDG*0..]
                        ->(dep)
                            -[dep_edge:PDG]
                                ->(property)
    WHERE
        property.Id = \"{second_lookup_obj}\" AND
        value_taint.RelationType = "TAINT" AND
        dep_edge.RelationType = "DEP" AND 
        ALL(edge IN tainted_value_path WHERE
            edge.RelationType = "SO" OR
            edge.RelationType = "ARG" OR
            edge.RelationType = "DEP")
    RETURN distinct value
    """


def get_ast_source_and_assignment(assignment_obj, second_lookup_obj):
    return f"""
    MATCH
        (source_cfg)
            -[source_ref:REF]
                ->(value),
        (assignment_cfg)
            -[assignment_ref:REF]
                ->(property)
    WHERE
        value.Id = \"{assignment_obj}\" AND
        property.Id = \"{second_lookup_obj}\"
    RETURN distinct source_cfg, assignment_cfg
    """


class PrototypePollution:
    first_lookup_obj = ""
    assignment_obj = ""
    second_lookup_obj = ""

    """
    Prototype Pollution Queries
    """
    check_lookup_pattern = """
        MATCH
            (sub_obj:PDG_OBJECT)
                -[nv:PDG]
                    ->(nv_sub_obj:PDG_OBJECT)
                        -[second_lookup:PDG]
                            ->(property:PDG_OBJECT)
        WHERE
            nv.RelationType = "NV" AND
            nv.IdentifierName = "*" AND
            second_lookup.RelationType = "SO" AND
            second_lookup.IdentifierName = "*"
        RETURN distinct sub_obj, nv_sub_obj, property
    """
    
    """
    Find all prototype pollution.
    Will lead to a lot of false positives but if the graph
    is well parsed the false negative rate will be close to 0.
    """

    queries = [
        ("check_lookup_pattern", check_lookup_pattern),
        ("check_taint_key", check_taint_key),
        ("check_tainted_assignment", check_tainted_assignment),
        ("check_taint_sub_key", check_taint_sub_key),
        ("get_ast_source_and_assignment", get_ast_source_and_assignment),
    ]

    def __init__(self, query: Query):
        self.query = query

    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f"[INFO] Running prototype pollution query: {self.queries[0][0]}")
        self.query.start_timer()
        pattern_results = session.run(self.check_lookup_pattern)
        sinks = set()
        keys = {}

        if(pattern_results.peek() is None):
            self.query.time_detection("proto_pollution")
            return vuln_paths

        detection_results = []

        # get the relevant objects that are used as keys (will be checked if attacker has control over them)
        for pattern in pattern_results:
            self.first_lookup_obj = pattern['sub_obj']['Id']
            self.assignment_obj = pattern['nv_sub_obj']['Id']
            self.second_lookup_obj = pattern['property']['Id']
            sinks.add(pattern['sub_obj']['Id'])
            sinks.add(pattern['nv_sub_obj']['Id'])
            sinks.add(pattern['property']['Id'])
            keys[pattern] = set([pattern['sub_obj']['Id'], pattern['nv_sub_obj']['Id'], pattern['property']['Id']])

        sink_string = "[" + ",".join([f"\"{sink}\"" for sink in sinks]) + "]"
        self.query.reset_call_info()

        print(f"[INFO] Running prototype pollution query: Checking taint paths")
        # look for taint paths in the graph that lead to the keys found in the previous step
        taint_paths,_ = self.query.find_taint_paths(session,"TAINT_SOURCE",
                                                 lambda x: x['Id'] in sinks,sink_string)
        starts = [record["start"]["Id"] for record in taint_paths if record["start"]["Id"] in sinks]

        # restrict the edges that are allowed in the taint paths
        taint_paths = list(filter(lambda x: all(rel["RelationType"] in ["SO","DEP","TAINT","RET"] or rel["RelationType"].startswith("ARG") \
                                               for rel in x["path"].relationships), taint_paths))

        paths_to_report = []
        sources = {}

        
        for record in taint_paths:
            sink = record["sink"]["Id"]
            # check for all assignments if the key influenced the assignment
            for pattern,ids in keys.items():
                if sink in ids:
                    ids.remove(sink)
                    # if all the necessary keys are tainted that assignment is vulnerable and should be reported
                    if len(ids) == 0:
                        paths_to_report.append(pattern)
                        
                # since we're reporting the assignment we need to know the source of the taint
                if sink == pattern['property']['Id']:
                    sources[pattern] = record["start"]["Id"] if record["start"]["Type"] != "TAINT_SOURCE" \
                        else record["path"].nodes[1]["Id"]
                    

        # some starting nodes might be the necessary keys themselves (so they're not in the taint paths)
        for start in starts:
                for pattern,ids in keys.items():
                    if start in ids:
                        ids.remove(start)
                        if len(ids) == 0:
                            paths_to_report.append(pattern)
                        if start == pattern['property']['Id']:
                            sources[pattern] = start

                    
        for path in paths_to_report:
            print(f"[INFO] Running prototype pollution query: {self.queries[4][0]}")
            ast_results = session.run(get_ast_source_and_assignment(sources[path], path['property']['Id']))
            for ast_result in ast_results:
                sink_location = json.loads(ast_result["assignment_cfg"]["Location"])
                sink_lineno = sink_location["start"]["line"]
                file = sink_location["fname"]
                sink = my_utils.get_code_line_from_file(vuln_file, sink_lineno)
                vuln_path = {
                    "vuln_type": "prototype-pollution",
                    "file": file,
                    "sink": sink,
                    "sink_lineno": sink_lineno
                }
                my_utils.save_intermediate_output(vuln_path, detection_output)
                if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                    vuln_paths.append(vuln_path)
                else:
                    source_cfg = ast_result["source_cfg"]
                    source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
                    detection_results.append({
                        "sink_obj": ast_result["assignment_cfg"],
                        "sink_lineno": sink_lineno,
                        "source_lineno": source_lineno,
                        "sink_name": sink
                        }
                    )

        self.query.time_detection("proto_pollution")

        if self.query.reconstruct_types:
            print(f'[INFO] Prototype Pollution - Reconstructing attacker-controlled data.')
            for detection_result in detection_results:
                detection_objs = structure_queries.get_source(
                    session, detection_result["sink_obj"], detection_result["sink_lineno"],
                    detection_result["source_lineno"], detection_result["sink"],
                    "prototype-pollution", config)

                for detection_obj in detection_objs:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)

            self.query.time_reconstruction("proto_pollution")

        return vuln_paths
