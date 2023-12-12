from queries.injection import Injection
from queries.proto_pollution import PrototypePollution


class Queries:
	# all must be instances of QueryType
	query_types = []

	def __init__(self):
		self.query_types += [Injection(), PrototypePollution()]

	def get_query_types(self):
		return self.query_types
