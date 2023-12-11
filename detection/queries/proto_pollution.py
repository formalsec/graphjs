from queries.query_type import QueryType
import queries.structure_queries as structure_queries
import my_utils.utils as my_utils
import json
import os
import time
from sys import stderr

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


class PrototypePollution(QueryType):

	first_lookup_obj = ""
	assignment_obj = ""
	second_lookup_obj = ""

	"""
	Prototype Pollution Queries
	"""
	check_lookup_pattern = """
		MATCH
			(obj:PDG_OBJECT)
				-[first_lookup:PDG]
					->(sub_obj:PDG_OBJECT)
						-[nv:PDG]
							->(nv_sub_obj:PDG_OBJECT)
								-[second_lookup:PDG]
									->(property:PDG_OBJECT)
		WHERE
			first_lookup.RelationType = "SO" AND
			first_lookup.IdentifierName = "*" AND
			nv.RelationType = "NV" AND
			nv.IdentifierName = "*" AND
			second_lookup.RelationType = "SO" AND
			second_lookup.IdentifierName = "*"
		RETURN distinct sub_obj, nv_sub_obj, property

		UNION
		MATCH
			(obj:PDG_OBJECT)
				-[first_lookup:PDG]
					->(sub_obj:PDG_OBJECT)
						-[arg:PDG*]
							->(arg_sub_obj:PDG_OBJECT)
								-[nv:PDG]
									->(nv_sub_obj:PDG_OBJECT)
										-[second_lookup:PDG]
											->(property:PDG_OBJECT)
		WHERE
			first_lookup.RelationType = "SO" AND
			first_lookup.IdentifierName = "*" AND
			ALL(edge IN arg WHERE edge.RelationType = "ARG") AND
			nv.RelationType = "NV" AND
			nv.IdentifierName = "*" AND
			second_lookup.RelationType = "SO" AND
			second_lookup.IdentifierName = "*"
		RETURN distinct sub_obj, nv_sub_obj, property

	"""

	def check_taint_key(self, first_lookup_obj):
		return f"""
			MATCH
				(source:TAINT_SOURCE)
					-[key_taint:PDG]
						->(key:PDG_OBJECT)
							-[tainted_key_path:PDG*1..]
								->(sub_obj)
			WHERE
				sub_obj.Id = \"{first_lookup_obj}\" AND
				key_taint.RelationType = "TAINT" AND
				ALL(edge IN tainted_key_path WHERE
					edge.RelationType = "SO" OR
					edge.RelationType = "ARG" OR
					edge.RelationType = "DEP")
			RETURN DISTINCT source
		"""

	def check_tainted_assignment(self, assignment_obj):
		return f"""
			MATCH
				(source)
					-[subKey_taint:PDG]
						->(subKey:PDG_OBJECT)
							-[tainted_subKey_path:PDG*1..]
								->(nv_sub_obj)
			WHERE
				nv_sub_obj.Id = \"{assignment_obj}\" AND
				subKey_taint.RelationType = "TAINT" AND
				ALL(edge IN tainted_subKey_path WHERE
					edge.RelationType = "SO" OR
					edge.RelationType = "ARG" OR
					edge.RelationType = "DEP")
			RETURN distinct source
		"""

	def check_taint_sub_key(self, second_lookup_obj):
		return f"""
		MATCH
			(source)
				-[value_taint:PDG]
					->(value:PDG_OBJECT)
						-[tainted_value_path:PDG*1..]
							->(property)
		WHERE
			property.Id = \"{second_lookup_obj}\" AND
			value_taint.RelationType = "TAINT" AND
			ALL(edge IN tainted_value_path WHERE
				edge.RelationType = "SO" OR
				edge.RelationType = "ARG" OR
				edge.RelationType = "DEP")
		RETURN distinct value
		"""

	def get_ast_source_and_assignment(self, assignment_obj, second_lookup_obj):
		return f"""
		MATCH
			(source_cfg)
				-[source_ref:REF]
					->(value),
			(assignment_cfg)
				-[assignment_ref:REF]
					->(property)
		WHERE
			value.Id = \"{assignment_obj}\" AND
			property.Id = \"{second_lookup_obj}\"
		RETURN
			source_cfg, assignment_cfg
		"""


	"""
	Prototype Pollution Recursive Query
	"""
	proto_pollution_recursive_query = """
		MATCH
			// First lookup sub-query
			(obj:PDG_OBJECT)
				-[first_lookup:PDG]
					->(sub_obj:PDG_OBJECT)
		MATCH
			// Arg
			(sub_obj)
				-[arg:PDG]
					->(obj)
		MATCH
			// Object assignment sub-query
			(obj)
				-[nv:PDG]
					->(nv_sub_obj:PDG_OBJECT)
						-[second_lookup:PDG]
							->(property:PDG_OBJECT),
			// First lookup property is tainted sub-query
			(source:TAINT_SOURCE)
				-[key_taint:PDG]
					->(key:PDG_OBJECT)
						-[tainted_key_path:PDG*1..]
							->(sub_obj)
		MATCH
			// Object assignment property is tainted sub-query
			(source)
				-[subKey_taint:PDG]
					->(subKey:PDG_OBJECT)
						-[tainted_subKey_path:PDG*1..]
							->(nv_sub_obj)
		MATCH
			// Object assignment assigned value is tainted sub-query
			(source)
				-[value_taint:PDG]
					->(value:PDG_OBJECT)
						-[tainted_value_path:PDG*1..]
							->(property),
			// AST source sub-query
			(source_cfg)
				-[source_ref:REF]
					->(value),
			// AST object assignment sub-query
			(assignment_cfg)
				-[assignment_ref:REF]
					->(property)
		WHERE
			first_lookup.RelationType = "SO" AND
			first_lookup.IdentifierName = "*" AND
			nv.RelationType = "NV" AND
			nv.IdentifierName = "*" AND
			second_lookup.RelationType = "SO" AND
			second_lookup.IdentifierName = "*" AND
			-key_taint.RelationType = "TAINT" AND
			subKey_taint.RelationType = "TAINT" AND
			value_taint.RelationType = "TAINT" AND
			-ALL(edge IN tainted_key_path WHERE
				edge.RelationType = "SO" OR
				edge.RelationType = "ARG" OR
				edge.RelationType = "DEP") AND
			ALL(edge IN tainted_subKey_path WHERE
				edge.RelationType = "SO" OR
				edge.RelationType = "ARG" OR
				edge.RelationType = "DEP") AND
			ALL(edge IN tainted_value_path WHERE
				edge.RelationType = "SO" OR
				edge.RelationType = "ARG" OR
				edge.RelationType = "DEP")
		RETURN *
	"""
	"""
	Find all prototype pollution.
	Will lead to a lot of false positives but if the graph
	is well parsed the false negative rate will be close to 0.
	"""

	queries = [
		("check_lookup_pattern", check_lookup_pattern),
		("check_taint_key", check_taint_key),
		("check_tainted_assignment", check_tainted_assignment),
		("check_taint_sub_key", check_taint_sub_key),
		("get_ast_source_and_assignment", get_ast_source_and_assignment),
	]

	def __init__(self, reconstruct_types = True):
		QueryType.__init__(self, "Prototype Pollution")
		self.reconstruct_types = reconstruct_types
		self.start_time = None
		self.detection_time = 0
		self.reconstruction_time = 0

	def find_vulnerable_paths(self, session, vuln_paths, attacker_controlled_data, vuln_file, detection_output, config):
		"""
		Find prototype pollution vulnerabilities paths.
		"""
		print(f"[INFO] - Running prototype pollution query: {self.queries[0][0]}")
		self.start_timer()  # start timer
		pattern_results = session.run(self.queries[0][1])
		self.increment_detection()  # time injection

		detection_results = []
		for pattern in pattern_results:
			self.first_lookup_obj = pattern.get('sub_obj')._properties.get("Id")
			self.assignment_obj = pattern.get('nv_sub_obj')._properties.get("Id")
			self.second_lookup_obj = pattern.get('property')._properties.get("Id")

			print(f"[INFO] - Running prototype pollution query: {self.queries[1][0]}")
			taint_key_results = session.run(self.check_taint_key(self.first_lookup_obj))
			# If query is unable to find a taint key path, go to next pattern
			if taint_key_results.peek() is None:
				self.increment_detection()  # time injection
				continue

			print(f"[INFO] - Running prototype pollution query: {self.queries[2][0]}")
			taint_assignment_results = session.run(self.check_tainted_assignment(self.assignment_obj))
			# If query is unable to find a taint assignment path, go to next pattern
			if taint_assignment_results.peek() is None:
				self.increment_detection()  # time injection
				continue

			print(f"[INFO] - Running prototype pollution query: {self.queries[3][0]}")
			taint_sub_key_results = session.run(self.check_taint_sub_key(self.second_lookup_obj))
			# If query is unable to find a taint sub key path, go to next pattern
			if taint_sub_key_results.peek() is None:
				self.increment_detection()  # time injection
				continue

			print(f'[INFO][{THIS_SCRIPT_NAME}] - Analyzing detected vulnerabilities.')
			for tainted_source in taint_sub_key_results:
				source = tainted_source.get('value')._properties.get("Id")
				print(f"[INFO] - Running prototype pollution query: {self.queries[4][0]}")
				ast_results = session.run(self.get_ast_source_and_assignment(source, self.second_lookup_obj))
				self.increment_detection()  # time injection

				for ast_result in ast_results:
					source_cfg = ast_result["source_cfg"]
					source_lineno = json.loads(source_cfg["Location"])["start"]["line"]
					sink_lineno = json.loads(ast_result["assignment_cfg"]["Location"])["start"]["line"]
					sink = my_utils.get_code_line_from_file(vuln_file, sink_lineno)

					vuln_path = {
						"vuln_type": "prototype-pollution",
						"source": source_cfg["IdentifierName"],
						"source_lineno": source_lineno,
						"sink": sink,
						"sink_lineno": sink_lineno,
					}
					my_utils.save_intermediate_output(vuln_path, detection_output)
					self.increment_detection()  # time injection
					detection_results.append({ "ast_result": ast_result, "source_cfg": source_cfg, "source_lineno": source_lineno, "sink_lineno": sink_lineno, "sink": sink })

		if self.reconstruct_types:
			print(f'[INFO][{THIS_SCRIPT_NAME}] - Reconstructing attacker-controlled data.')
			for detection_result in detection_results:
				source_cfg = detection_result["source_cfg"]
				source_lineno = detection_result["source_lineno"]
				sink_lineno = detection_result["sink_lineno"]
				sink =  detection_result["sink"]
				tainted_params, params_types = \
						self.reconstruct_attacker_controlled_data(
								session,
								detection_result["ast_result"],
								attacker_controlled_data,
								config
						)
				structure = structure_queries.get_context_stack(session,  detection_result["ast_result"]["assignment_cfg"])
				vuln_path = {
					"vuln_type": "prototype-pollution",
					"source": source_cfg["IdentifierName"],
					"source_lineno": source_lineno,
					"sink": sink,
					"sink_lineno": sink_lineno,
					"tainted_params": tainted_params,
					"params_types": params_types,
					"exploit_type": structure
				}

				if vuln_path not in vuln_paths:
					vuln_paths.append(vuln_path)

		self.increment_reconstruction()  # time injection

		self.time_stats()
		return vuln_paths

	# Timer related functions
	def start_timer(self):
		self.start_time = time.time()

	def time_stats(self):
		print(f'pp_detection: {self.detection_time}', file=stderr)  # output to file
		print(f'pp_reconstruction: {self.reconstruction_time}', file=stderr)  # output to file

	def increment_detection(self):
		pp_detection_time = (time.time() - self.start_time)*1000  # to ms
		self.detection_time += pp_detection_time
		self.start_timer()

	def increment_reconstruction(self):
		pp_reconstruction_time = (time.time() - self.start_time)*1000  # to ms
		self.reconstruction_time += pp_reconstruction_time
		self.start_timer()
