from queries.injection import Injection
from queries.proto_pollution import ProtoPollution

class Queries:
    # all must be instances of QueryType
    query_types = []

    def __init__(self):
        self.query_types += [Injection(), ProtoPollution()]

    def get_query_types(self):
        return self.query_types