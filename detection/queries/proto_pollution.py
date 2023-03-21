from queries.query_type import QueryType
import my_utils.utils as my_utils
import json
from sys import argv
import os

class PrototypePollution(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Prototype Pollution")

	def find_vulnerable_paths(self, session, vuln_paths):
		"""
		Find prototype pollution vulnerabilities paths.
		"""
		self.find_first_level_lookups(session, vuln_paths)

		return vuln_paths

	def find_first_level_lookups(self, session, vuln_paths):
		"""
		Find prototype pollution first level lookups.
		E.g. obj[key] = value
		"""
		query = f"""
			MATCH
				(tamp_obj:PDG_OBJECT)
					-[nv_edge:PDG]
						->()
							-[so_edge:PDG]	
								->(sink:PDG_OBJECT),
				//(source:TAINT_SOURCE)
				//	-[param_edge_0:PDG]
				//		->(param_0:PDG_OBJECT)
				//			-[dep_edges_0:PDG*1..]
				//				->(sink),
				//(source)
				//	-[param_edge_1:PDG]
				//		->(param_1:PDG_OBJECT)
				//			-[dep_edges_1:PDG*1..]
				//				->(sink),
				(source_cfg)
					-[param_ref:REF]
						->(param),
				(sink_cfg)
					-[:REF]
						->(sink)
			MATCH
				cfg_path=
					(source_cfg)
						-[cfg_edges: CFG|FD*1..]
							->(sink_cfg)
			WHERE 
				nv_edge.RelationType = "NV" AND
				nv_edge.IdentifierName = "*" AND
				so_edge.RelationType = "SO" AND
				so_edge.IdentifierName = "*" AND
				//param_edge_0.RelationType = "TAINT" AND
				//dep_edges_0[-1].RelationType = "DEP" AND
                //param_edge_1.RelationType = "TAINT" AND
				//dep_edges_1[-1].RelationType = "DEP" AND
				param_ref.RelationType = "param" //AND
                //param_0.Id <> param_1.Id
			RETURN *
		"""

		results = session.run(query)

		for record in results:
			source_cfg = record["source_cfg"]
			source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
			sink_lineno = json.loads(record["sink_cfg"]["Location"])["start"]["line"]
			filename = argv[1][0:-len(os.path.splitext(argv[1])[1])] + "-normalized.js"
			sink = my_utils.get_code_line_from_file(filename, sink_lineno)
			tainted_params, params_types = self.reconstruct_attacker_controlled_data(session, source_cfg["Id"]) 

			vuln_path = {
				"vuln_type": "prototype-pollution",
				"source": source_cfg["IdentifierName"],
				"source_lineno": source_lineno,
				"sink": sink,
				"sink_lineno": sink_lineno,
				"tainted_params": tainted_params,
				"params_types": params_types,
				# "lines": self.find_vulnerable_lines(record["cfg_path"])
			}
			if vuln_path not in vuln_paths:
				vuln_paths.append(vuln_path)


	def find_several_levels_lookups(self, session, vuln_paths):
		"""
		Find prototype pollution first level lookups.
		E.g. obj[key][subKey] = value; obj[key][subKey][subSubKey] = value
		"""
		vuln_paths = []
		query = f"""
			MATCH

			MATCH
				cfg_path=
					(source_cfg)
						-[cfg_edges: CFG|FD*1..]
							->(sink_cfg)
			WHERE 

			RETURN *
		"""

		results = session.run(query)

		for record in results:
			sink_name = record["sink"]["IdentifierName"]
			source_cfg = record["source_cfg"]
			source_location = json.loads(source_cfg["Location"])
			sink_location = json.loads(record["sink_cfg"]["Location"])
			tainted_params, params_types = self.reconstruct_attacker_controlled_data(session, source_cfg["Id"]) 

			vuln_path = {
				"vuln_type": "prototype-pollution",
				"source": source_cfg["IdentifierName"],
				"source_lineno": source_location["start"]["line"],
				"sink": sink_name,
				"sink_lineno": sink_location["start"]["line"],
				"tainted_params": tainted_params,
				"params_types": params_types,
				# "lines": self.find_vulnerable_lines(record["cfg_path"])
			}
			if vuln_path not in vuln_paths:
				vuln_paths.append(vuln_path)

		return vuln_paths