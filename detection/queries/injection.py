from .interaction_protocol import interaction_protocol
from .my_utils import utils as my_utils
import json

from .query import Query


class Injection:
	intra_injection_query = f"""
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
					->(sink),
			(sink_cfg)
				-[:AST]
					->(sink_ast)
		WHERE
			param_edge.RelationType = "TAINT" AND
			param_ref.RelationType = "param"
		RETURN *
	"""

	bottom_up_greedy_injection_query = f"""
		MATCH
			(func:VariableDeclarator)
				-[ref_edge:REF]
					->(param:PDG_OBJECT)
						-[edges:PDG*1..]
							->(sink:TAINT_SINK),

			(sink_cfg)
				-[:SINK]
					->(sink),

			(sink_cfg)
				-[:AST]
					->(sink_ast)

			WHERE
				ref_edge.RelationType = "param" AND
				ALL(
					edge in edges WHERE
					NOT edge.RelationType = "ARG" OR
					edge.valid = true
				)
			RETURN *
		"""

	# Cache the taint propagation information
	callInfo = {}

	def __init__(self, query: Query):
		self.query = query

	def find_vulnerable_paths(self, session, vuln_paths, source_file, filename: str, detection_output, query_type, config):
		print(f'[INFO] Running injection query.')
		self.query.start_timer()
		detection_results = []

		# Run query based on type
		if query_type == 'intra':
			results = session.run(self.intra_injection_query)
		elif query_type == 'bottom_up_greedy':
			results = session.run(self.bottom_up_greedy_injection_query)
		else:
			results = []

		for record in results:
			if query_type == "intra" or (query_type == "bottom_up_greedy" and
			self.query.confirm_vulnerability(session, record["func"]["Id"], record["param"])):

				sink_name = record["sink"]["IdentifierName"]
				sink_lineno = json.loads(record["sink_ast"]["Location"])["start"]["line"]
				file = json.loads(record["sink_ast"]["Location"])["fname"]
				sink = my_utils.get_code_line_from_file(file, sink_lineno)
				vuln_type: str = my_utils.get_injection_type(sink_name, config)
				vuln_path = {
					"filename": file,
					"vuln_type": vuln_type,
					"sink": sink,
					"sink_lineno": sink_lineno,
					"sink_function": record["sink_cfg"]["Id"]
				}
				my_utils.save_intermediate_output(vuln_path, detection_output)
				if not self.query.reconstruct_types and vuln_path not in vuln_paths:
					vuln_paths.append(vuln_path)
				elif self.query.reconstruct_types and vuln_path not in vuln_paths:
					detection_results.append(vuln_path)
		self.query.time_detection("injection")

		if self.query.reconstruct_types:
			print(f'[INFO] Reconstructing attacker-controlled data.')
			for detection_result in detection_results:
				vulnerabilities = interaction_protocol.get_vulnerability_info(session, detection_result, source_file, config)
				for detection_obj in vulnerabilities:
					if detection_obj not in vuln_paths:
						vuln_paths.append(detection_obj)
			self.query.time_reconstruction("injection")

		return vuln_paths
