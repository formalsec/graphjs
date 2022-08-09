from abc import abstractclassmethod, abstractmethod


class QueryType:
    def __init__(self):
        pass

    @abstractmethod
    def find_pdg_paths(self, session, sources, sinks):
        pass

    @abstractmethod
    def validate_pdg_paths(self, paths, param_types):
        pass