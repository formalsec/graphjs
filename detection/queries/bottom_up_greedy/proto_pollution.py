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


def generate_query_list_string(objs, add_begin_end=True):
	# checks if all the objects in the assignment are vulnerable
	return "[" + ",".join([f"\"{obj}\"" for obj in objs]) + "]" \
		if add_begin_end else ",".join([f"\"{obj}\"" for obj in objs])


# this query connects the argument to the parameter (creates an auxiliary edge between the two nodes)
# this is used to speed up the query
def connect_arg_to_param():
	return f"""
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


def remove_arg_to_param():
	return f"""
		MATCH
			()-[parameter_rel:PARAMETER]->()
		DELETE parameter_rel
"""


def check_lookup_pattern():
	return """
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
		RETURN distinct obj, property1, property2, value, property
		
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
		RETURN distinct obj, property1, property2, value, property
		"""


def is_tainted(session, query, property1, property2, value):
	# Checks if the assignment is tainted
	# first it adds the label POLLUTION_SINK to property1, property2 and value
	# this simply speeds up the query, because only these nodes are considered as sinks at a time
	# (in large graphs, the huge number of PDG_OBJECTS would slow down the query significantly)
	
	def is_object_tainted(session, id):
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
			if query.confirm_vulnerability(session, record["func"]["Id"], record["param"]):
				return True
		return False
	
	def set_pollution_sink(session, property1, property2, value):
		query = f"""
			MATCH (obj:PDG_OBJECT)
			WHERE obj.Id IN [\"{property1}\",\"{property2}\",\"{value}\"]
			SET obj:POLLUTION_SINK
		"""
		
		session.run(query)
	
	def remove_pollution_sink(session, property1, property2, value):
		query = f"""
			MATCH (obj:POLLUTION_SINK)
			WHERE obj.Id IN [\"{property1}\",\"{property2}\",\"{value}\"]
			REMOVE obj:POLLUTION_SINK
		"""
		
		session.run(query)
	
	if property1["isExported"] and property2["isExported"] and value["isExported"]:
		return True
	
	property1 = property1["Id"]
	property2 = property2["Id"]
	value = value["Id"]
	
	set_pollution_sink(session, property1, property2, value)
	
	result = is_object_tainted(session, property1) \
		and is_object_tainted(session, property2) and \
		is_object_tainted(session, value)
	
	remove_pollution_sink(session, property1, property2, value)
	return result


def get_detection_results(session, query):
	detection_results = []
	orig_obj = None
	tainted_source = None
	
	session.run(connect_arg_to_param())
	results = session.run(check_lookup_pattern())
	
	for record in results:
		orig_obj = record["obj"]
		property1 = record["property1"]
		property2 = record["property2"]
		value = record["value"]
		prop = record["property"]["Id"]
		
		if is_tainted(session, query, property1, property2, value):
			detection_results = session.run(get_ast_source_and_assignment(prop))
			tainted_source = value
	
	session.run(remove_arg_to_param())
	
	return detection_results, orig_obj, tainted_source
