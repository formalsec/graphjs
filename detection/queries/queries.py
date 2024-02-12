from .injection import Injection
from .proto_pollution import PrototypePollution


class Queries:
	query_types = []

	def __init__(self, reconstruct_args):
		self.query_types += [Injection(reconstruct_args), PrototypePollution(reconstruct_args)]

	def get_query_types(self):
		return self.query_types
