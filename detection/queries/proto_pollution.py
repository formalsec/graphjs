from queries.query_type import QueryType
import my_utils.utils as my_utils
import json
from sys import argv
import os

class PrototypePollution(QueryType):
	"""
	Find prototype pollution first level lookups.
	E.g. for() { obj[key] = value }
	"""
	first_level_lookup_query =  f"""
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
	E.g. obj[key][subKey] = value; obj[key][subKey][subSubKey] = value
	"""
	# several_levels_lookups_query =  f"""
	# 	MATCH
	# 		(tamp_obj:PDG_OBJECT)
	# 			-[so_edge_1:PDG]
	# 				->(first_lvl:PDG_OBJECT)
	# 					-[nv_edge:PDG]
	# 						->()
	# 							-[so_edge_2:PDG]	
	# 								->(sink:PDG_OBJECT),
	# 		(source:TAINT_SOURCE)
	# 			-[param_edge_1:PDG]
	# 				->(:PDG_OBJECT)
	# 					-[dep_edges_1:PDG*1..]
	# 						->(first_lvl),
	# 		(source)
	# 			-[param_edge_2:PDG]
	# 				->(param:PDG_OBJECT)
	# 					-[dep_edges_2:PDG*1..]
	# 						->(sink),
	# 		(source_cfg)
	# 			-[param_ref:REF]
	# 				->(param),
	# 		(sink_cfg)
	# 			-[:REF]
	# 				->(sink)
	# 	WHERE 
	# 		nv_edge.RelationType = "NV" AND
	# 		nv_edge.IdentifierName = "*" AND
	# 		so_edge_1.RelationType = "SO" AND
	# 		so_edge_1.IdentifierName = "*" AND
	# 		so_edge_2.RelationType = "SO" AND
	# 		so_edge_2.IdentifierName = "*" AND
	# 		param_edge_1.RelationType = "TAINT" AND
	# 		param_edge_2.RelationType = "TAINT" AND
	# 		dep_edges_1[-1].RelationType = "DEP" AND
	# 		dep_edges_2[-1].RelationType = "DEP" AND
	# 		param_ref.RelationType = "param" 
	# 	RETURN *
	# """
	queries = [first_level_lookup_query]

	def __init__(self):
		QueryType.__init__(self, "Prototype Pollution")

	def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, config):
		"""
		Find prototype pollution vulnerabilities paths.
		"""
		print("[INFO] - Running prototype pollution queries")
		for query in self.queries:
			results = session.run(query)
			for record in results:
				source_cfg = record["source_cfg"]
				source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
				sink_lineno = json.loads(record["sink_cfg"]["Location"])["start"]["line"]
				filename = vuln_file[0:-len(os.path.splitext(vuln_file)[1])] + "-normalized.js"
				sink = my_utils.get_code_line_from_file(filename, sink_lineno)
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

		return vuln_paths