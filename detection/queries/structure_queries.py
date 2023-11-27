import os

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


def get_stack_single_pattern(obj_id):
	return f"""
		MATCH
			(source)
				-[def:FD]
					->(fn_def)
						-[path:CFG*1..]
							->(sink_cfg)
		WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
		AND exists ((sink_cfg)-[:SINK]->({{Id: "{obj_id}"}}))
		RETURN distinct source, fn_def
		"""

def get_context_stack(session, obj):
	"""
	Check if object is lazy-object, e.g, {"*": {"*": "any"}}
	"""
	#print(obj.id)
	paths = session.run(get_stack_single_pattern(obj.id))
	#for path in paths:
		#print(path)
	return True
