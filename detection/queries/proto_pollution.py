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


def get_ast_source_and_assignment(second_lookup_obj):
    return f"""
    MATCH
        (assignment_cfg)
            -[assignment_ref:REF]
                ->(property)
    WHERE
        property.Id = \"{second_lookup_obj}\"
    RETURN distinct assignment_cfg
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
    def __init__(self,record, *keys):
        self.info = {key:False for key in keys}
        self.record = record
 
    def mark_as_vulnerable(self,keyId):
        # marks one the the objects in the assignment as vulnerable
        try:
            self.info[keyId] = True
        except KeyError:
            pass


    def is_vulnerable(self):
        # checks if all the objects in the assignment are vulnerable
        return all(self.info.values())
    
    def generate_query_list_string(self):
        # generates a string that can be used in a query
        return generate_query_list_string(list(self.info.keys()),
                                           add_begin_end=False)
    
    def __repr__(self) -> str:
        return f"Assignment: {self.info}"


class PrototypePollution:

    """
    Prototype Pollution Queries
    """
    
    """
    Find all prototype pollution.
    Will lead to a lot of false positives but if the graph
    is well parsed the false negative rate will be close to 0.
    """


    def __init__(self, query: Query):
        self.query = query

    def check_lookup_pattern(self, session):

        check_lookup_pattern_query = """
            MATCH
                (obj:PDG_OBJECT)
                    -[first_lookup:PDG]
                        ->(sub_obj:PDG_OBJECT),

                (property1:PDG_OBJECT)
                    -[dep1:PDG]
                        ->(sub_obj)
            WHERE
                first_lookup.RelationType = "SO" AND
                first_lookup.IdentifierName = "*" AND
                dep1.RelationType = "DEP"

            MATCH
                (sub_obj)
                    -[nv:PDG]
                        ->(nv_sub_obj:PDG_OBJECT)
                            -[second_lookup:PDG]
                                ->(property:PDG_OBJECT),
                
                (property2:PDG_OBJECT)
                    -[dep2:PDG]
                        ->(nv_sub_obj), 

                (value:PDG_OBJECT)
                    -[dep3:PDG]
                        ->(property)     
            
            WHERE
                nv.RelationType = "NV" AND
                nv.IdentifierName = "*" AND
                second_lookup.RelationType = "SO" AND
                second_lookup.IdentifierName = "*" AND
                dep2.RelationType = "DEP" AND
                dep3.RelationType = "DEP"
        RETURN distinct property1, property2, value,property

        UNION
        MATCH pattern=  
            (obj:PDG_OBJECT)
                -[first_lookup:PDG]
                    ->(sub_obj:PDG_OBJECT)
                        -[arg_edges:PDG|CG|REF*1..]
                                ->(param:PDG_OBJECT)
                                    -[nv:PDG]
                                        ->(nv_sub_obj:PDG_OBJECT)
                                            -[second_lookup:PDG]
                                                ->(property:PDG_OBJECT),

            (property1:PDG_OBJECT)
                -[dep1:PDG]
                    ->(sub_obj),
            
            (property2:PDG_OBJECT)
                -[dep2:PDG]
                    ->(nv_sub_obj), 

            (value:PDG_OBJECT)
                -[dep3:PDG]
                    ->(property)  

        WHERE
            first_lookup.RelationType = "SO" AND
            first_lookup.IdentifierName = "*" AND
            nv.RelationType = "NV" AND
            nv.IdentifierName = "*" AND
            second_lookup.RelationType = "SO" AND
            second_lookup.IdentifierName = "*" AND
            ALL(edge in arg_edges WHERE not edge.RelationType = "ARG" OR 
                ANY(node in nodes(pattern) WHERE node.IdentifierName = edge.IdentifierName)) AND
            dep1.RelationType = "DEP" AND
            dep2.RelationType = "DEP" AND
            dep3.RelationType = "DEP"
        RETURN distinct property1, property2, value,property
        """

        results = session.run(check_lookup_pattern_query)
        sinks = set()
        possible_assignments = []

        for record in results:
            property1 = record["property1"]["Id"]
            property2 = record["property2"]["Id"]
            value = record["value"]["Id"]
            assignment = DangerousAssignment(record,property1, value, property2)
            possible_assignments.append(assignment)
            sinks.add(property1)
            sinks.add(value)
            sinks.add(property2)


        return sinks,possible_assignments
        
    queries = [
        ("check_lookup_pattern", check_lookup_pattern),
        ("check_taint_key", check_taint_key),
        ("check_tainted_assignment", check_tainted_assignment),
        ("check_taint_sub_key", check_taint_sub_key),
        ("get_ast_source_and_assignment", get_ast_source_and_assignment),
    ]

    def find_tainted_assignments(self, session, sinks,dangerous_assignments):
        sinks_str = "[" + ",".join([assignment.generate_query_list_string() for assignment in dangerous_assignments]) + "]"
        self.query.reset_call_info()

        # find tainted paths in the graph
        taint_paths,_ = self.query.find_taint_paths(session,"TAINT_SOURCE",
                                                 lambda x: x['Id'] in sinks,sinks_str)
        
        # mark the object as vulnerable if the attacker can have control over it
        for record in taint_paths:
            sink = record["sink"]["Id"]
            for assignment in dangerous_assignments:
                assignment.mark_as_vulnerable(sink)

        # return the assignments that are vulnerable (i.e, attacker can control first lookup, second lookup and the assigment object)
        return list(filter(lambda x: x.is_vulnerable(), dangerous_assignments))
    
    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f"[INFO] Running prototype pollution query: {self.queries[0][0]}")
        self.query.start_timer()

        # check if the graph has the pattern of prototype pollution
        sinks,possible_assignments = self.check_lookup_pattern(session)
       
        if possible_assignments == []:
            return vuln_paths
        
        # verify that the attcker has control over the first lookup, second lookup and the assigment object
        print(f"[INFO] Running prototype pollution query: check_taint_paths")
        vulnerable_assignments = self.find_tainted_assignments(session, sinks,possible_assignments)


        if vulnerable_assignments == []:
            return vuln_paths
        
        # if there are any assignments that meet the above criteria, report them
        print(f"[INFO] Running prototype pollution query: {self.queries[4][0]}")
        for assignment in vulnerable_assignments:
            ast_results = session.run(get_ast_source_and_assignment(assignment.record['property']['Id']))
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
                
        self.query.time_detection("proto_pollution")

        return vuln_paths
