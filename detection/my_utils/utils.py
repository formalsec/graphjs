from os import path
import json
from pprint import pprint


def console(s, debug=True):
	if debug:
		try:
			print(json.dumps(s, indent=4))
		except:
			pprint(s)


def read_config():
	file_path = path.realpath(path.dirname(__file__))
	config_path = path.join(file_path, "../config.json")
	with open(config_path, "r") as configFile:
		return json.load(configFile)


def get_all_sinks_from_config(config):
	sinks = []
	if "sinks" in config:
		vuln_types = config["sinks"]
		for vuln in vuln_types:
			sinks.extend(vuln_types[vuln])
	else:
		raise Exception("Config file is missing the sinks")
	return sinks


def get_all_sources_from_config(config):
	if "sources" in config:
		return config["sources"]
	else:
		raise Exception("Config file is missing the sources")