from queries.query_type import QueryType
import queries.structure_queries as structure_queries
import my_utils.utils as my_utils
import json
import os
import time
from sys import stderr

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


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

	def __init__(self, reconstruct_types = True):
		QueryType.__init__(self, "Injection")
		self.start_time = None
		self.reconstruct_types = reconstruct_types

	def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, detection_output, config):
		"""
		Find injection vulnerabilities paths.
		"""
		print(f'[INFO][{THIS_SCRIPT_NAME}] - Running injection query.')
		self.start_timer()  # start timer
		results = session.run(self.injection_query)

		print(f'[INFO][{THIS_SCRIPT_NAME}] - Analyzing detected vulnerabilities.')
		for record in results:
			sink_name = record["sink"]["IdentifierName"]
			source_cfg = record["source_cfg"]
			source_ast = record["source_ast"]
			source_location = json.loads(source_cfg["Location"])
			sink_location = json.loads(record["sink_cfg"]["Location"])  # ,
			vuln_path = {
				"vuln_type": my_utils.get_injection_type(sink_name, config),
				"source": source_cfg["IdentifierName"] if source_ast["Type"] == "FunctionExpression" or source_ast[
					"Type"] == "ArrowFunctionExpression" else param_name,
				"source_lineno": source_location["start"]["line"],
				"sink": sink_name,
				"sink_lineno": sink_location["start"]["line"],
			}
			my_utils.save_intermediate_output(vuln_path, detection_output)
		self.time_detection()  # time injection

		if self.reconstruct_types:
			print(f'[INFO][{THIS_SCRIPT_NAME}] - Reconstructing attacker-controlled data.')
			for record in results:
			    sink_name = record["sink"]["IdentifierName"]
                source_cfg = record["source_cfg"]
                source_ast = record["source_ast"]
                param_name = my_utils.format_name(record["param"]["IdentifierName"])
                source_location = json.loads(source_cfg["Location"])
                sink_location = json.loads(record["sink_cfg"]["Location"])  # ,
				tainted_params, params_types = \
					self.reconstruct_attacker_controlled_data(session, record,
											   attacker_controlled_data, config)
				exploit_type = structure_queries.get_context_stack(session, record["sink"])
                vuln_path = {
                    "vuln_type": my_utils.get_injection_type(sink_name, config),
                    "source": source_cfg["IdentifierName"] if source_ast["Type"] == "FunctionExpression" or source_ast[
                        "Type"] == "ArrowFunctionExpression" else param_name,
                    "source_lineno": source_location["start"]["line"],
                    "sink": sink_name,
                    "sink_lineno": sink_location["start"]["line"],
                    "tainted_params": tainted_params,
                    "params_types": params_types,
                    "exploit_type": exploit_type
                }
                if vuln_path not in vuln_paths:
                    vuln_paths.append(vuln_path)

		self.time_reconstruction()
		return vuln_paths

	# Timer related functions
	def start_timer(self):
		self.start_time = time.time()

	def time_detection(self):
		injection_detection_time = (time.time() - self.start_time) * 1000  # to ms
		print(f'injection_detection: {injection_detection_time}', file=stderr)  # output to file
		self.start_timer()

	def time_reconstruction(self):
		reconstruction_detection_time = (time.time() - self.start_time) * 1000  # to ms
		print(f'injection_reconstruction: {reconstruction_detection_time}', file=stderr)  # output to file
