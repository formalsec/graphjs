from queries.query_type import QueryType
import my_utils.utils as my_utils
import json
import time
from sys import stderr

class Injection(QueryType):
	injection_query = f"""
		MATCH
			(source:TAINT_SOURCE)
				-[param_edge:PDG]
					->(param:PDG_OBJECT)
						-[pdg_edges:PDG*1..]
							->(sink:TAINT_SINK),
			(source_cfg)
				-[param_ref:REF]
					->(param),
			(source_cfg)
				-[:AST]
					->(source_ast),
			(sink_cfg)
				-[:SINK]
					->(sink)
		WHERE 
			param_edge.RelationType = "TAINT" AND
			param_ref.RelationType = "param" 
		RETURN *
	"""
	
	def __init__(self):
		QueryType.__init__(self, "Injection")

	def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, config):
		"""
		Find injection vulnerabilities paths.
		"""
		print("[INFO] - Running injection query")
		results = session.run(self.injection_query)
		print(f"injection_detection: {time.time()*1000}", file=stderr) # END_TIMER_INJECTION_DETECTION

		print("[INFO] - Reconstructing attacker-controlled data")
		for record in results:
			sink_name = record["sink"]["IdentifierName"]
			source_cfg = record["source_cfg"]
			source_ast = record["source_ast"]
			param_name = my_utils.format_name(record["param"]["IdentifierName"])
			source_location = json.loads(source_cfg["Location"])
			sink_location = json.loads(record["sink_cfg"]["Location"])
			tainted_params, params_types = self.reconstruct_attacker_controlled_data(session, source_cfg["Id"], record["sink_cfg"]["Id"], attacker_controlled_data, config) 

			vuln_path = {
				"vuln_type": my_utils.get_injection_type(sink_name, config),
				"source":  source_cfg["IdentifierName"] if source_ast["Type"] == "FunctionExpression" or source_ast["Type"] == "ArrowFunctionExpression" else param_name,
				"source_lineno": source_location["start"]["line"],
				"sink": sink_name,
				"sink_lineno": sink_location["start"]["line"],
				"tainted_params": tainted_params,
				"params_types": params_types,
			}
			if vuln_path not in vuln_paths:
				vuln_paths.append(vuln_path)

		print(f"injection_reconstruction: {time.time()*1000}", file=stderr) # END_TIMER_INJECTION_RECONSTRUCTION
		return vuln_paths