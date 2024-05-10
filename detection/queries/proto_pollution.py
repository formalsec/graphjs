from .query import Query
from . import interaction_protocol
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
            (obj:PDG_OBJECT)
                -[first_lookup:PDG]
                    ->(sub_obj:PDG_OBJECT)
                        -[nv:PDG]
                            ->(nv_sub_obj:PDG_OBJECT)
                                -[second_lookup:PDG]
                                    ->(property:PDG_OBJECT)
        WHERE
            first_lookup.RelationType = "SO" AND
            first_lookup.IdentifierName = "*" AND
            nv.RelationType = "NV" AND
            nv.IdentifierName = "*" AND
            second_lookup.RelationType = "SO" AND
            second_lookup.IdentifierName = "*"
        RETURN distinct sub_obj, nv_sub_obj, property

        UNION
        MATCH
            (obj:PDG_OBJECT)
                -[first_lookup:PDG]
                    ->(sub_obj:PDG_OBJECT)
                        -[arg:PDG*]
                            ->(arg_sub_obj:PDG_OBJECT)
                                -[nv:PDG]
                                    ->(nv_sub_obj:PDG_OBJECT)
                                        -[second_lookup:PDG]
                                            ->(property:PDG_OBJECT)
        WHERE
            first_lookup.RelationType = "SO" AND
            first_lookup.IdentifierName = "*" AND
            ALL(edge IN arg WHERE edge.RelationType = "ARG") AND
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

    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, filename: str, detection_output, config):
        print(f"[INFO] Running prototype pollution query: {self.queries[0][0]}")
        self.query.start_timer()
        pattern_results = session.run(self.queries[0][1])

        detection_results = []
        for pattern in pattern_results:
            self.first_lookup_obj = pattern['sub_obj']['Id']
            self.assignment_obj = pattern['nv_sub_obj']['Id']
            self.second_lookup_obj = pattern['property']['Id']

            print(f"[INFO] Running prototype pollution query: {self.queries[1][0]}")
            taint_key_results = session.run(check_taint_key(self.first_lookup_obj))
            # If query is unable to find a taint key path, go to next pattern
            if taint_key_results.peek() is None:
                continue

            print(f"[INFO] Running prototype pollution query: {self.queries[2][0]}")
            taint_assignment_results = session.run(check_tainted_assignment(self.assignment_obj))
            # If query is unable to find a taint assignment path, go to next pattern
            if taint_assignment_results.peek() is None:
                continue

            print(f"[INFO] Running prototype pollution query: {self.queries[3][0]}")
            taint_sub_key_results = session.run(check_taint_sub_key(self.second_lookup_obj))
            # If query is unable to find a taint sub key path, go to next pattern
            if taint_sub_key_results.peek() is None:
                continue

            print(f'[INFO] Prototype Pollution - Analyzing detected vulnerabilities.')
            for tainted_source in taint_sub_key_results:
                source = tainted_source['value']['Id']
                print(f"[INFO] Running prototype pollution query: {self.queries[4][0]}")
                ast_results = session.run(get_ast_source_and_assignment(source, self.second_lookup_obj))

                for ast_result in ast_results:
                    sink_location = json.loads(ast_result["assignment_cfg"]["Location"])
                    sink_lineno = sink_location["start"]["line"]
                    sink = my_utils.get_code_line_from_file(vuln_file, sink_lineno)
                    vuln_path = {
                        "vuln_type": "prototype-pollution",
                        "sink": sink,
                        "sink_lineno": sink_lineno
                    }
                    my_utils.save_intermediate_output(vuln_path, detection_output)
                    if not self.query.reconstruct_types and vuln_path not in vuln_paths:
                        vuln_paths.append(vuln_path)
                    elif self.query.reconstruct_types and vuln_path not in vuln_paths:
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
                detection_objs = interaction_protocol.get_vulnerability_info(
                    session, detection_result["sink_obj"], detection_result["sink_lineno"],
                    detection_result["source_lineno"], detection_result["sink"],
                    "prototype-pollution", config)

                for detection_obj in detection_objs:
                    if detection_obj not in vuln_paths:
                        vuln_paths.append(detection_obj)

            self.query.time_reconstruction("proto_pollution")

        return vuln_paths
