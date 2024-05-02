from abc import abstractmethod
import time
from typing import TypedDict


class DetectionResult(TypedDict):
	filename: str
	vuln_type: str
	sink: str
	sink_lineno: int
	sink_function: int


class Query:
	query_types = []
	time_output_file = None
	reconstruct_args = False
	start_time = None

	def __init__(self, reconstruct_types, time_output_file):
		self.time_output_file = time_output_file
		self.reconstruct_types = reconstruct_types

	@abstractmethod
	def find_vulnerable_paths(self, session, detection_result: DetectionResult, config):
		pass

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
