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

def generate_query_list_string(objs,add_begin_end=True):
    # checks if all the objects in the assignment are vulnerable
    return "[" + ",".join([f"\"{obj}\"" for obj in objs]) + "]" \
        if add_begin_end else ",".join([f"\"{obj}\"" for obj in objs])

class DangerousAssignment:
    """
    This class is used to keep track of the first lookup object, the assignment object and the second lookup object
    that are connected in the graph. If the attacker can control all three objects, then the object is marked as vulnerable
    """
    def __init__(self, first_lookup_obj, assignment_obj, second_lookup_obj):
        self.first_lookup_obj = first_lookup_obj
        self.assignment_obj = assignment_obj
        self.second_lookup_obj = second_lookup_obj
        self.info = {self.first_lookup_obj: False, self.assignment_obj: False, self.second_lookup_obj: False}
        self.source = None
 
    def mark_as_vulnerable(self,keyId,record):
        # marks one the the objects in the assignment as vulnerable
        self.info[keyId] = True
        if keyId == self.second_lookup_obj:
            self.source = record["start"]["Id"] if record["start"]["Type"] != "TAINT_SOURCE" \
                        else record["path"].nodes[1]["Id"]


    def is_vulnerable(self):
        # checks if all the objects in the assignment are vulnerable
        return all(self.info.values())
    
    def generate_query_list_string(self):
        # generates a string that can be used in a query
        return generate_query_list_string([self.first_lookup_obj,self.assignment_obj,self.second_lookup_obj],
                                           add_begin_end=False)
    
    def __repr__(self) -> str:
        return f"First Lookup: {self.first_lookup_obj}, Assignment: {self.assignment_obj}, Second Lookup: {self.second_lookup_obj}"


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
        self.keys = {}

    def find_first_lookup_obj(self, session):

        first_lookup_query = """
            MATCH
                (obj:PDG_OBJECT)
                    -[first_lookup:PDG]
                        ->(sub_obj:PDG_OBJECT)
            WHERE
                first_lookup.RelationType = "SO" AND
                first_lookup.IdentifierName = "*"
            RETURN distinct sub_obj
        """

        results = session.run(first_lookup_query)

        return [record["sub_obj"]["Id"] for record in results]
        
    def connect_to_second_lookup(self, session, startList,sub_obj=None):

        def get_second_lookup_obj(startList):
            ## This query will connect the first lookup object to the second lookup object
            # We consider differnt variables for different cases. We always return distinct results
            # Stoping cases:
            #       PDG_OBJECT:
            #           - Verifiy that edge is a NV edge and the IdentifierName is "*"
            #           - second_lookup edge is a SO edge and the IdentifierName is "*"
            #       PDG_CALL:
            #           - Get the param in question, ensure that we have an ARG edge
            #           - Get the return object, ensure that we have a RET edge
            #       PDG_RETURN:
            #           - Find that calls to that function which that return object corresponds
            #           - Get the next object, ensure that we have a RET edge
            connection_query = f"""
                MATCH
                    (start:PDG_OBJECT)
                        -[edge:PDG]
                            ->(end:PDG_OBJECT|PDG_RETURN|PDG_CALL)                
                WHERE
                    start.Id IN {startList}

                OPTIONAL MATCH
                    (end:PDG_CALL)
                        -[:CG]
                            ->(:VariableDeclarator)
                                -[param_ref:REF]
                                    ->(param:PDG_OBJECT),
                    (end)
                        -[ret:PDG]
                            ->(ret_obj:PDG_OBJECT)
                WHERE
                    edge.RelationType CONTAINS "ARG" AND 
                    edge.RelationType CONTAINS param.IdentifierName AND
                    ret.RelationType = "RET"

                OPTIONAL MATCH
                    (end:PDG_OBJECT)
                        -[second_lookup:PDG]
                            ->(property:PDG_OBJECT)
                WHERE
                    second_lookup.RelationType = "SO" AND
                    second_lookup.IdentifierName = "*"

                OPTIONAL MATCH
                    (call:PDG_CALL)
                        -[:CG]
                            ->(:VariableDeclarator)
                                -[:REF|PDG*1..]
                                    ->(end:PDG_RETURN),
                    (call)
                        -[return_edge:PDG]
                            ->(next_obj:PDG_OBJECT)


                WHERE
                    return_edge.RelationType = "RET"
                RETURN distinct *
            """

            return session.run(connection_query)
        
        dangerous_assignments = []
        sinks = set()
        results = get_second_lookup_obj(startList)
        cont = False
       
        for record in results:

            first_lookup_obj = sub_obj if sub_obj else record["start"]["Id"]
            if record["end"]["Type"] == "PDG_OBJECT" and record["edge"]["RelationType"] == "NV" \
                and record["edge"]["IdentifierName"] == "*":
                assignment = DangerousAssignment(first_lookup_obj
                                        , record["end"]["Id"], record["property"]["Id"])
                dangerous_assignments.append(assignment)
                self.keys[first_lookup_obj] = assignment
                self.keys[record["end"]["Id"]] = assignment
                self.keys[record["property"]["Id"]] = assignment
                sinks.add(record["end"]["Id"])
                sinks.add(record["property"]["Id"])
                sinks.add(first_lookup_obj)



            elif record["end"]["Type"] == "PDG_CALL":
                other_assignments,cont,other_sinks = self.connect_to_second_lookup(session,
                                                                       generate_query_list_string([record["param"]["Id"]]),
                                                                       first_lookup_obj)
                # called function's return object is directly connected to 
                # the param in question (the caller's path needs to be continued)
                if cont: 
                    other_assignments,cont,other_sinks = self.connect_to_second_lookup(session, \
                                                                       generate_query_list_string([record["ret_obj"]["Id"]]),
                                                                       first_lookup_obj)
                dangerous_assignments += other_assignments
                sinks.update(other_sinks)

            elif record["end"]["Type"] == "PDG_RETURN":
                cont = True
                if record["next_obj"]:
                    other_assignments,cont,other_sinks = self.connect_to_second_lookup(session,
                                                                       generate_query_list_string([record["next_obj"]["Id"]]),
                                                                       first_lookup_obj)
                    
                    dangerous_assignments += other_assignments
                    sinks.update(other_sinks)
                    

        return dangerous_assignments,cont,sinks

    def find_tainted_assignments(self, session, sinks,dangerous_assignments):
        sinks_str = "[" + ",".join([assignment.generate_query_list_string() for assignment in dangerous_assignments]) + "]"
        self.query.reset_call_info()

        # find tainted paths in the graph
        taint_paths,_ = self.query.find_taint_paths(session,"TAINT_SOURCE",
                                                 lambda x: x['Id'] in sinks,sinks_str)
        
        # ensure that only DEP,SO, TAINT, RET are used to find those taint relationships
        taint_paths = list(filter(lambda x: all(rel["RelationType"] in ["SO","DEP","TAINT","RET"] or rel["RelationType"].startswith("ARG") \
                                               for rel in x["path"].relationships), taint_paths))
        
        # mark the object as vulnerable if the attacker can have control over it
        for record in taint_paths:
            sink = record["sink"]["Id"]
            self.keys[sink].mark_as_vulnerable(sink,record)

        # return the assignments that are vulnerable (i.e, attacker can control first lookup, second lookup and the assigment object)
        return list(filter(lambda x: x.is_vulnerable(), dangerous_assignments))
    
    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f"[INFO] Running prototype pollution query: {self.queries[0][0]}")
        self.query.start_timer()

        # identify the first lookup objects that the attacker can control over
        sub_objs = self.find_first_lookup_obj(session)
        detection_results = []

        # connect this first lookup object to the second lookup object (they might go through call chains or function's return)
        dangerous_assignments,_ ,sinks= self.connect_to_second_lookup(session, generate_query_list_string(sub_objs))

        if dangerous_assignments == []:
            return vuln_paths
        
        # verify that the attcker has control over the first lookup, second lookup and the assigment object
        print(f"[INFO] Running prototype pollution query: check_taint_paths")
        vulnerable_assignments = self.find_tainted_assignments(session, sinks,dangerous_assignments)

        if vulnerable_assignments == []:
            return vuln_paths
        
        # if there are any assignments that meet the above criteria, reporte them
        for assignment in vulnerable_assignments:
            print(f"[INFO] Running prototype pollution query: {self.queries[4][0]}")
            ast_results = session.run(get_ast_source_and_assignment(assignment.source, assignment.second_lookup_obj))
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
