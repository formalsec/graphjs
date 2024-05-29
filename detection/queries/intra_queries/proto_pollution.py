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


def check_lookup_pattern():
    return """
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
        RETURN distinct obj, sub_obj, nv_sub_obj, property

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
        RETURN distinct obj, sub_obj, nv_sub_obj, property
    """


def get_detection_results(session):
    detection_results = []
    orig_obj = None
    tainted_source = None
    pattern_results = session.run(check_lookup_pattern())
    
    for pattern in pattern_results:
        orig_obj = pattern['obj']
        first_lookup_obj = pattern['sub_obj']['Id']
        assignment_obj = pattern['nv_sub_obj']['Id']
        second_lookup_obj = pattern['property']['Id']
        
        taint_key_results = session.run(check_taint_key(first_lookup_obj))
        # If query is unable to find a taint key path, go to next pattern
        if taint_key_results.peek() is None:
            continue
        
        taint_assignment_results = session.run(check_tainted_assignment(assignment_obj))
        # If query is unable to find a taint assignment path, go to next pattern
        if taint_assignment_results.peek() is None:
            continue
        
        taint_sub_key_results = session.run(check_taint_sub_key(second_lookup_obj))
        # If query is unable to find a taint sub key path, go to next pattern
        if taint_sub_key_results.peek() is None:
            continue
        
        for tainted_source in taint_sub_key_results:
            source = tainted_source['value']['Id']
            detection_results = session.run(get_ast_source_and_assignment(source, second_lookup_obj))
            
    return detection_results, orig_obj, tainted_source["value"]
