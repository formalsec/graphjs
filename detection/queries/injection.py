from queries.query_type import QueryType
from .find_functions import find_source_params
import my_utils.utils as my_utils
import json

class Injection(QueryType):
	def __init__(self):
		QueryType.__init__(self, "Injection")

	def find_vulnerable_paths(self, session):
		"""
		Find injection vulnerabilities paths.
		"""
		vuln_paths = []
		query = f"""
			MATCH
				(source:TAINT_SOURCE)
					-[param_edge:PDG]
						-(param:PDG_OBJECT)
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

		results = session.run(query)

		for record in results:
			sink = record["sink"]["IdentifierName"]
			source_cfg = record["source_cfg"]
			source_location = json.loads(source_cfg["Location"])
			sink_location = json.loads(record["sink_cfg"]["Location"])
			vuln_path = {
				"vuln_type": my_utils.get_injection_type(sink),
				"source": source_cfg["IdentifierName"],
				"source_lineno": source_location["start"]["line"],
				"sink": sink,
				"sink_lineno": sink_location["start"]["line"],
				"tainted_params": find_source_params(session, record["source_cfg"]["Id"]),
				"params_types": {}
				# "vars": param_types[func],
			}
			if vuln_path not in vuln_paths:
				vuln_paths.append(vuln_path)

		return vuln_paths