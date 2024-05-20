from abc import abstractmethod
import time


class Query:
	query_types = []
	time_output_file = None
	reconstruct_args = False
	start_time = None

	cgt = {} # transposed call graph

	def __init__(self, reconstruct_types, time_output_file):
		self.time_output_file = time_output_file
		self.reconstruct_types = reconstruct_types


	@abstractmethod
	def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
		pass
	
	def process_cg(self,session):

		def check_propagation(session,func):
				reaches_return = f"""
					MATCH 
						(func:VariableDeclarator)
							-[:REF]
								->(param:PDG_OBJECT)
									-[edges:PDG*1..]
										->(return:PDG_RETURN)

					WHERE 
						func.Id = \"{func}\" AND
						ALL(
							edge in edges WHERE
							NOT edge.RelationType = "ARG" OR
							edge.valid = true
                    	)	
									
						
					MATCH
						(obj:PDG_OBJECT)
							-[arg_edge:PDG]
								->(call:PDG_CALL)
									-[:CG]
										->(func)

					WHERE
						arg_edge.IdentifierName = param.IdentifierName

					SET arg_edge.valid = true
					RETURN *
				"""

				session.run(reaches_return)
		
		def process_call_graph(session,cg,start,visited=set()):

			if start in visited:
				return

			visited.add(start)

			if start in cg:
				for callee in cg[start]:
					process_call_graph(session,cg,callee[1],visited)

			check_propagation(session,start)

		set_this_undefined_calls = f"""
			MATCH 
				(arg:PDG_OBJECT)
					-[arg_edge:PDG]
						->(:PDG_CALL)

			WHERE 
				arg_edge.IdentifierName = "this" OR arg_edge.IdentifierName = "undefined"

			SET arg_edge.valid = true
		"""

		session.run(set_this_undefined_calls)

		get_call_graph = """
				MATCH 
					(func:VariableDeclarator)
						-[ref_edge:REF]
							->(call:PDG_CALL)
								-[:CG]
									->(called_func:VariableDeclarator),
					(func)
						-[:AST]
							->(:FunctionExpression)
				WHERE
					ref_edge.RelationType = "call"
					RETURN DISTINCT func, COLLECT({call: call, called_func: called_func}) AS calls
		"""

		# check the taint propagation according to the call graph
		cg = {}
		results = session.run(get_call_graph)

		for record in results:
			func = record["func"]["Id"]
			cg[func] = set(map(lambda x: (x["call"]["Id"],x["called_func"]["Id"]), record["calls"]))

		visited = set()
		for start in cg.keys():
			if start not in visited:
				process_call_graph(session,cg,start,visited)


		add_param_tag_query  = """
				MATCH
					(func:VariableDeclarator)
						-[param_edge:REF]
							->(param:PDG_OBJECT)
				WHERE
					param_edge.RelationType = 'param'

				SET param:PDG_PARAM
				WITH param
				WHERE 
				EXISTS {
					MATCH 
						(:TAINT_SOURCE)
							-[taint:PDG]
								->(param)
					WHERE
					taint.RelationType = 'TAINT'
				}
				SET param.isExported = true
				
    	"""

		session.run(add_param_tag_query)

		self.transpose_cg(session,cg)
		
		


	def find_taint_paths(self,session):
		return []
	
	def confirm_vulnerability(self,identifier):
		if identifier in self.cgt:
			visited = set()
			args_list = [self.cgt[identifier]]
			while args_list != []:
				current = args_list.pop()
				visited.update(current)
				if any([x[1] for x in current]):
					return True
				
				args_list += [self.cgt[x[0]] for x in current if x[0] in self.cgt and x not in visited]
		return False

	# Timer related functions
	def start_timer(self):
		self.start_time = time.time()

	def time_detection(self, type):
		detection_time = (time.time() - self.start_time) * 1000  # to ms
		print(f'{type}_detection: {detection_time}', file=open(self.time_output_file, 'a'))
		self.start_timer()

	def time_reconstruction(self, type):
		reconstruction_time = (time.time() - self.start_time) * 1000  # to ms
		print(f'{type}_reconstruction: {reconstruction_time}', file=open(self.time_output_file, 'a'))

	def transpose_cg(self,session,cg):

		def get_params(session,func):
			get_params_query = f"""
				MATCH
					(func:VariableDeclarator)
						-[param_edge:REF]
							->(param:PDG_PARAM)
				WHERE
					func.Id = \"{func}\" AND
					param_edge.RelationType = 'param' AND
					param_edge.ParamIndex <> 'this'
				RETURN collect(param.Id) as params
			"""

			params = session.run(get_params_query).single()["params"]
			return "[" + ",".join([f"\"{x}\"" for x in params]) + "]" if params != [] else ""
		
		def reaches_caller(session,paramsId,callId):
			reaches_caller_query = f"""
				MATCH
					(param:PDG_PARAM)
						-[edges:PDG*1..]
							->(call:PDG_CALL)
				WHERE
					ALL(
							edge in edges[..-1] WHERE
							NOT edge.RelationType = "ARG" OR
							edge.valid = true
                    ) AND
					param.Id IN {paramsId} AND
					call.Id = \"{callId}\"
				RETURN DISTINCT param as argument, LAST(edges).IdentifierName as parameter
			"""

			return session.run(reaches_caller_query)
		
		for caller in cg:

			params = get_params(session,caller)
			if params == "":
				continue

			for callee in cg[caller]:
					results = reaches_caller(session,params,callee[0])

					for record in results:
						
						parameter = record["parameter"]
						if parameter not in self.cgt:
							self.cgt[parameter] = set()

						self.cgt[parameter].add((record["argument"]["IdentifierName"],record["argument"]["isExported"]))
						
				