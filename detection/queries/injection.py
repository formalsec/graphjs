from queries.query_type import QueryType
import my_utils.utils as my_utils
import json

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

	def find_vulnerable_paths(self, session, vuln_paths, config):
		"""
		Find injection vulnerabilities paths.
		"""
		results = session.run(self.injection_query)

		for record in results:
			sink_name = record["sink"]["IdentifierName"]
			source_cfg = record["source_cfg"]
			source_location = json.loads(source_cfg["Location"])
			sink_location = json.loads(record["sink_cfg"]["Location"])
			tainted_params, params_types = self.reconstruct_attacker_controlled_data(session, source_cfg["Id"], config) 

			vuln_path = {
				"vuln_type": my_utils.get_injection_type(sink_name, config),
				"source": source_cfg["IdentifierName"],
				"source_lineno": source_location["start"]["line"],
				"sink": sink_name,
				"sink_lineno": sink_location["start"]["line"],
				"tainted_params": tainted_params,
				"params_types": params_types,
			}
			if vuln_path not in vuln_paths:
				vuln_paths.append(vuln_path)

		return vuln_paths