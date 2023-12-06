import os

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


def function_is_object_prop(obj_id):
	return f"""
		MATCH
			({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
				-[dep:PDG]->(sub_obj:PDG_OBJECT)
					<-[so:PDG]-(obj:PDG_OBJECT)
		WHERE dep.RelationType = "DEP" 
		AND so.RelationType = "SO"
		AND NOT so.IdentifierName = "exports" 
		RETURN distinct obj.IdentifierName, so.IdentifierName
	"""


def get_outer_context(obj_id):
	return f"""
		MATCH
			(source)-[def:FD]->(fn_def)
				-[path:CFG*1..]->({{Id: "{obj_id}"}})
		WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
		RETURN distinct source
		"""


def get_stack_single_pattern(obj_id):
	return f"""
		MATCH
			(source)-[def:FD]->(fn_def)
				-[path:CFG*1..]->(sink_cfg)
		WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
		AND exists ((sink_cfg)-[:SINK]->({{Id: "{obj_id}"}}))
		RETURN distinct source
		"""


def get_context_stack(session, obj):
	# Find first level
	fn_node = session.run(get_stack_single_pattern(obj.id)).single()
	if not fn_node:
		print("Unable to detect source function")
		return "-"

	# Try to find outer contexts
	fn_node_id = fn_node["source"]["Id"]
	contexts = [fn_node_id]
	while True:
		fn_node = session.run(get_outer_context(fn_node_id)).single()
		if fn_node is not None:
			fn_node_id = fn_node["source"]["Id"]
			contexts.append(fn_node_id)
		break

	# Check if function is a property of an object
	object_prop = session.run(function_is_object_prop(contexts[-1])).single()
	if object_prop:
		obj_name = object_prop["obj.IdentifierName"]
		obj_prop = object_prop["so.IdentifierName"]
		return f"VFunPropOfExportedObj {obj_name}.{obj_prop}"
	else:
		if len(contexts) > 1:
			return f"VFunRetByExport: {', '.join(contexts)}"
		else:
			return "VFunExported"
