from queries.injection import Injection


class Queries:
    # all must be instances of QueryType
    query_types = []

    def __init__(self):
        self.query_types.append(Injection())

    def get_query_types(self):
        return self.query_types