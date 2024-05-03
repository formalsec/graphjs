from abc import abstractmethod
import time


class Query:
	query_types = []
	time_output_file = None
	reconstruct_args = False
	start_time = None
	# cache the taint propagation information
	callInfo = {}

	def __init__(self, reconstruct_types, time_output_file):
		self.time_output_file = time_output_file
		self.reconstruct_types = reconstruct_types


	@abstractmethod
	def find_vulnerable_paths(self, session, vuln_paths, vuln_file, detection_output, config):
		pass

	def taint_query(self,session,identifier,sinks="[]"):
		taint_query = f"""
			MATCH path = 
				(start)
					-[path_edges:PDG*1..]
						->(sink)
				
			WHERE
				(start.IdentifierName = \"{identifier}\") AND
				(sink.Id IN {sinks} OR sink.Type IN ["PDG_RETURN","PDG_CALL","TAINT_SINK"])

			OPTIONAL MATCH
				(start)
					-[call_edges:PDG*1..]
						->(path_call:PDG_CALL)
				WHERE
					LAST(call_edges) IN path_edges

			OPTIONAL MATCH  
				(sink_cfg)
					-[:SINK]
						->(sink),

				(sink_cfg)
					-[:AST]
						->(sink_ast)
			
			RETURN collect(LAST(call_edges)) as path_calls,sink,sink_ast,path,sink_cfg,start;
		"""

		return session.run(taint_query)

	def find_taint_paths(self,session,start,is_sink=lambda x: x["Type"] == "TAINT_SINK",sinks="[]",callChain=set()):
		results = []
		vulnerable_paths = []
		if(start == "TAINT_SOURCE"):
			results = self.taint_query(session,identifier="TAINT_SOURCE",sinks=sinks)
		else:
			results = self.taint_query(session,identifier=start,sinks=sinks)

		taintPropagation = False
		for result in results:
			valid = True
			for call in result["path_calls"]:
				arg = call["RelationType"]
				arg = arg[arg.find("(")+1:arg.find(")")]

				if arg == "self" or arg == "undefined":
					continue

				if not arg in self.callInfo: # haven't checked this arg before
					new_paths,callTaintPropagation = self.find_taint_paths(session,arg,is_sink,sinks,callChain=callChain.union([arg])) if not arg in callChain else ([],False) # avoid infinite recursion
					vulnerable_paths += new_paths
					if not callTaintPropagation:
						valid = False
						self.callInfo[arg] = False
						break
					else:
						self.callInfo[arg] = True
				elif not self.callInfo[arg]: # cache tells that arg doens't propagate taint
					valid = False
					break

			if valid  and is_sink(result["sink"]): # we have a valid path to a sink
				vulnerable_paths.append(result)
			elif valid and result["sink"]["Type"] == "PDG_RETURN":
				taintPropagation = True
		
		return vulnerable_paths,taintPropagation
	
	def reset_call_info(self):
		self.callInfo = {}

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
