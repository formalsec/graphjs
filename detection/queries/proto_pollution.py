from queries.query_type import QueryType
import my_utils.utils as my_utils
import json
import time
from sys import stderr

class PrototypePollution(QueryType):
	"""
	Find all prototype pollution. 
	Will lead to a lot of false positives but if the graph 
	is well parsed the false negative rate will be close to 0.
	"""
	lookup_query =  f"""
		MATCH
			(tamp_obj:PDG_OBJECT)
				-[nv_edge:PDG]
					->()
						-[so_edge:PDG]	
							->(sink:PDG_OBJECT),
			(source:TAINT_SOURCE)
				-[param_edge:PDG]
					->(param:PDG_OBJECT)
						-[dep_edges:PDG*1..]
							->(sink),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(sink_cfg)
				-[:REF]
					->(sink)
		WHERE 
			nv_edge.RelationType = "NV" AND
			nv_edge.IdentifierName = "*" AND
			so_edge.RelationType = "SO" AND
			so_edge.IdentifierName = "*" AND
			param_edge.RelationType = "TAINT" AND
			dep_edges[-1].RelationType = "DEP" AND
			param_ref.RelationType = "param"
		RETURN *
	"""
	"""
	Find prototype pollution first level lookups.
	E.g. for() { obj[key] = value }
	"""
	first_level_lookup_loop_query =  f"""
		MATCH
			(tamp_obj:PDG_OBJECT)
				-[nv_edge:PDG]
					->()
						-[so_edge:PDG]	
							->(sink:PDG_OBJECT),
			(source:TAINT_SOURCE)
				-[param_edge:PDG]
					->(param:PDG_OBJECT)
						-[dep_edges:PDG*1..]
							->(sink),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(sink_cfg)
				-[:REF]
					->(sink),
			(loop)
				-[:CFG*1..]
					->(sink_cfg)
		WHERE 
			nv_edge.RelationType = "NV" AND
			nv_edge.IdentifierName = "*" AND
			so_edge.RelationType = "SO" AND
			so_edge.IdentifierName = "*" AND
			param_edge.RelationType = "TAINT" AND
			dep_edges[-1].RelationType = "DEP" AND
			(loop:ForInStatement OR loop:ForOfStatement OR loop:WhileStatement) AND
			param_ref.RelationType = "param"
		RETURN *
	"""
	"""
	Find prototype pollution first level lookups inside loops. forEach(), etc
	E.g. source.forEach(key => { obj[key] = value })
	"""
	first_level_lookup_function_loop_query =  f"""
		MATCH
			(tamp_obj:PDG_OBJECT)
				-[nv_edge:PDG]
					->()
						-[so_edge:PDG]	
							->(sink:PDG_OBJECT),
			(source:TAINT_SOURCE)
				-[param_edge:PDG]
					->(param:PDG_OBJECT)
						-[dep_edges:PDG*1..]
							->(sink),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(sink_cfg)
				-[:REF]
					->(sink),
			(arg_func:VariableDeclarator)
				-[cfg_fd_cg_edges*1..]
					->(sink_cfg),
			(arg_func)
				-[:CFG]
					->(:VariableDeclarator)
						-[init_edge:AST]
							->(call_exp:CallExpression)
								-[callee_edge:AST]
									->(mem_exp:MemberExpression)
										-[prop_edge:AST]
											->(function:Identifier),
			(mem_exp)
				-[obj_edge:AST]
					->(:Identifier),
			(call_exp)
				-[arg_edge:AST]
					->(called_func:Identifier)
		WHERE 
			nv_edge.RelationType = "NV" AND
			nv_edge.IdentifierName = "*" AND
			so_edge.RelationType = "SO" AND
			so_edge.IdentifierName = "*" AND
			param_edge.RelationType = "TAINT" AND
			dep_edges[-1].RelationType = "DEP" AND
			param_ref.RelationType = "param" AND 
			ALL(edge IN cfg_fd_cg_edges WHERE edge:CFG OR edge:FD OR edge:CG) AND
			init_edge.RelationType = "init" AND
			callee_edge.RelationType = "callee" AND
			prop_edge.RelationType = "property" AND
			obj_edge.RelationType = "object" AND
			function.IdentifierName = "forEach" AND
			arg_edge.RelationType = "arg" AND
			arg_edge.ArgumentIndex = "1" AND
			arg_func.IdentifierName = called_func.IdentifierName
		RETURN *
	"""
	"""
	Recursive prototype pollution.
	E.g. Merge Objects or Set Property: merge(target[key], value);
	"""
	recursive_lookup_query =  f"""
		MATCH
			(tamp_obj:PDG_OBJECT)
				-[nv_edge:PDG]
					->()
						-[so_edge:PDG]	
							->(sink:PDG_OBJECT),
			(tamp_obj)
				-[so_rec:PDG]
					->(tamp_obj_rec:PDG_OBJECT),
			(tamp_obj_rec)
				-[arg_edge:PDG]
					->(tamp_obj),
			(source:TAINT_SOURCE)
				-[param_edge:PDG]
					->(param:PDG_OBJECT)
						-[dep_edges:PDG*1..]
							->(sink),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(sink_cfg)
				-[:REF]
					->(sink)
		WHERE 
			nv_edge.RelationType = "NV" AND
			nv_edge.IdentifierName = "*" AND
			so_edge.RelationType = "SO" AND
			so_edge.IdentifierName = "*" AND
			so_rec.RelationType = "SO" AND
			so_rec.IdentifierName = "*" AND
			arg_edge.RelationType = "ARG" AND
			param_edge.RelationType = "TAINT" AND
			dep_edges[-1].RelationType = "DEP" AND
			param_ref.RelationType = "param"
		RETURN *
	"""
	"""
	Find prototype pollution direct level lookups.
	E.g. obj[key][subKey] = value; obj[key][subKey][subSubKey] = value
	"""
	several_levels_lookups_query =  f"""
		MATCH
			(tamp_obj:PDG_OBJECT)
				-[so_edge_1:PDG]
					->(first_lvl:PDG_OBJECT)
						-[nv_edge:PDG]
							->()
								-[so_edge_2:PDG]	
									->(sink:PDG_OBJECT),
			(source:TAINT_SOURCE)
				-[param_edge_1:PDG]
					->(:PDG_OBJECT)
						-[dep_edges_1:PDG*1..]
							->(first_lvl),
			(source)
				-[param_edge_2:PDG]
					->(param:PDG_OBJECT)
						-[dep_edges_2:PDG*1..]
							->(sink),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(sink_cfg)
				-[:REF]
					->(sink)
		WHERE 
			nv_edge.RelationType = "NV" AND
			nv_edge.IdentifierName = "*" AND
			so_edge_1.RelationType = "SO" AND
			so_edge_1.IdentifierName = "*" AND
			so_edge_2.RelationType = "SO" AND
			so_edge_2.IdentifierName = "*" AND
			param_edge_1.RelationType = "TAINT" AND
			param_edge_2.RelationType = "TAINT" AND
			dep_edges_1[-1].RelationType = "DEP" AND
			dep_edges_2[-1].RelationType = "DEP" AND
			param_ref.RelationType = "param" 
		RETURN *
	"""
	# queries = [
	# 	("first_level_lookup_loop_query", first_level_lookup_loop_query), 
	# 	# ("first_level_lookup_function_loop_query", first_level_lookup_function_loop_query), 
	# 	("recursive_lookup_query", recursive_lookup_query), 
	# 	("several_levels_lookups_query", several_levels_lookups_query)
	# ]
	queries = [("lookup_query", lookup_query)]

	def __init__(self):
		QueryType.__init__(self, "Prototype Pollution")

	def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, config):
		"""
		Find prototype pollution vulnerabilities paths.
		"""
		for query in self.queries:
			print(f"[INFO] - Running prototype pollution query: {query[0]}")
			results = session.run(query[1])
			print(f"proto_pollution_detection: {time.time()*1000}", file=stderr) # END_TIMER_PROTO_POLLUTION_DETECTION
			for record in results:
				source_cfg = record["source_cfg"]
				source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
				sink_lineno = json.loads(record["sink_cfg"]["Location"])["start"]["line"]
				sink = my_utils.get_code_line_from_file(vuln_file, sink_lineno)
				tainted_params, params_types = self.reconstruct_attacker_controlled_data(session, source_cfg["Id"], record["sink_cfg"]["Id"], attacker_controlled_data, config) 

				vuln_path = {
					"vuln_type": "prototype-pollution",
					"source": source_cfg["IdentifierName"],
					"source_lineno": source_lineno,
					"sink": sink,
					"sink_lineno": sink_lineno,
					"tainted_params": tainted_params,
					"params_types": params_types,
				}
				if vuln_path not in vuln_paths:
					vuln_paths.append(vuln_path)

		print(f"proto_pollution_reconstruction: {time.time()*1000}", file=stderr) # END_TIMER_PROTO_POLLUTION_RECONSTRUCTION
		return vuln_paths