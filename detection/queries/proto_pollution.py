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


class PrototypePollution:

    # this query connectst the argument to the parameter (creates an auxiliary edge between the two nodes)
    # this is used to speed up the query

    connect_arg_to_param = f"""
        MATCH 
            (arg:PDG_OBJECT)
                -[arg_edge:PDG]
                    ->(call_node:PDG_CALL)
                        -[:CG]
                            ->(func:VariableDeclarator)
                                -[:REF]
                                    ->(param:PDG_OBJECT)

        WHERE 
            arg_edge.IdentifierName = param.IdentifierName

        CREATE (arg)-[parameter_rel:PARAMETER]->(param)
    """

    remove_arg_to_param = f"""

        MATCH
            ()-[parameter_rel:PARAMETER]->()
        DELETE parameter_rel
    """

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


    check_lookup_pattern = """
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
                    -[arg_edges:PARAMETER*1..]
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
        dep1.RelationType = "DEP" AND
        dep2.RelationType = "DEP" AND
        dep3.RelationType = "DEP"
    RETURN distinct property1, property2, value,property
    """
        
    queries = [
        ("check_lookup_pattern",check_lookup_pattern),
        ("check_taint_key", check_taint_key),
        ("check_tainted_assignment", check_tainted_assignment),
        ("check_taint_sub_key", check_taint_sub_key),
        ("get_ast_source_and_assignment", get_ast_source_and_assignment),
    ]

    def is_tainted(self,session,property1,property2,value):

        # checks if the assignment is tainted
        # first it adds the label POLLUTION_SINK to property1, property2 and value
        # this simply speeds up the query, because only these nodes are considered as sinks at a time
        # (in large graphs, the huge number of PDG_OBJECTS would slow down the query significantly)

        def is_object_tainted(session,id):

            taint_query = f"""
                        MATCH  
                           (func:VariableDeclarator)
                                -[ref_edge:REF]
                                    ->(param:PDG_OBJECT)
                                        -[edges:PDG*0..]
                                            ->(sink:POLLUTION_SINK)

                        WHERE
                            ref_edge.RelationType = "param" AND 
                            sink.Id = \"{id}\" AND
                            ALL(
                                edge in edges WHERE
                                NOT edge.RelationType = "ARG" OR
                                edge.valid = true
                            )

                        RETURN *
                """
            for record in session.run(taint_query):
                if self.query.confirm_vulnerability(session,record["func"]["Id"],record["param"]):
                    return True
            return False
        

        def set_pollution_sink(session,property1,property2,value):

            query = f"""
                MATCH (obj:PDG_OBJECT)
                WHERE obj.Id IN [\"{property1}\",\"{property2}\",\"{value}\"]
                SET obj:POLLUTION_SINK
            """
            
            session.run(query)

        def remove_pollution_sink(session,property1,property2,value):

            query = f"""
                MATCH (obj:POLLUTION_SINK)
                WHERE obj.Id IN [\"{property1}\",\"{property2}\",\"{value}\"]
                REMOVE obj:POLLUTION_SINK
            """
            
            session.run(query)

        if(property1["isExported"] and property2["isExported"] and value["isExported"]):
            return True
        
        property1 = property1["Id"]
        property2 = property2["Id"]
        value = value["Id"]

        set_pollution_sink(session,property1,property2,value)

        result = is_object_tainted(session,property1) \
            and is_object_tainted(session,property2) and \
                is_object_tainted(session,value)
        
        
        remove_pollution_sink(session,property1,property2,value)
        return result

    
    def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
        print(f"[INFO] Running prototype pollution query: {self.queries[0][0]}")
        self.query.start_timer()

        session.run(self.connect_arg_to_param)

        results = session.run(self.check_lookup_pattern)

        for record in results:
            property1 = record["property1"]
            property2 = record["property2"]
            value = record["value"]
            property = record["property"]["Id"]

            if self.is_tainted(session,property1,property2,value):
                ast_results = session.run(get_ast_source_and_assignment(property))
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

        session.run(self.remove_arg_to_param)
        return vuln_paths
