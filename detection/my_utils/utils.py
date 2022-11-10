from os import path
import json
from pprint import pprint


def console(s, debug=True):
	if debug:
		try:
			print(json.dumps(s, indent=4))
		except:
			pprint(s)


def save_output(argv, results, type, detected):
	if len(argv) >= 2:
		output = argv[1]
		with open(output, "a") as f:
			if detected:
				f.write("{} vulnerability detected!\n".format(type))
				f.write(json.dumps(results, indent=4) + '\n')
			else:
				f.write("No vulnerability detected for type - {}\n".format(type))


def read_config():
	file_path = path.realpath(path.dirname(__file__))
	config_path = path.join(file_path, "../config.json")
	with open(config_path, "r") as configFile:
		return json.load(configFile)


def get_all_sinks_from_config(config):
	package_sinks = {}
	sinks = {}
	if "sinks" in config:
		vuln_types = config["sinks"]
		for vuln in vuln_types.values():
			for sink in vuln:
				if "packages" in sink.keys():
					package_sinks[sink["sink"]] = sink["packages"]
				else: 
					sinks[sink["sink"]] = sink["arg"]
	else:
		raise Exception("Config file is missing the sinks")
	return sinks, package_sinks

def get_all_sources_from_config(config):
	if "sources" in config:
		return config["sources"]
	else:
		raise Exception("Config file is missing the sources")