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
				f.write("no vulnerability detected for type - {}\n".format(type))

def save_output_multi_files(argv, results):
	if len(argv) >= 2:
		output = argv[1]
		for i in range(len(results)):
			with open(f"{output}.{i}.exjs", "w") as f:
				f.write(json.dumps(results[i], indent=4) + '\n')

def read_config():
	file_path = path.realpath(path.dirname(__file__))
	config_path = path.join(file_path, "../config.json")
	with open(config_path, "r") as configFile:
		return json.load(configFile)


def get_all_sinks_from_config(config):
	sinks = {}
	new_sinks = {}
	package_sinks = {}
	packages = {}
	if "sinks" in config:
		vuln_types = config["sinks"]
		for vuln in vuln_types.values():
			for sink in vuln:
				if "packages" in sink.keys():
					package_sinks[sink["sink"]] = sink["packages"]
				elif sink["type"] == "new":
					new_sinks[sink["sink"]] = sink["arg"]
				elif "package" in sink.keys():
					packages[sink["package"]] = sink["arg"]
				else: 
					sinks[sink["sink"]] = sink["arg"]
	else:
		raise Exception("Config file is missing the sinks")
	return sinks, new_sinks, package_sinks, packages

def get_all_sources_from_config(config):
	if "sources" in config:
		return config["sources"]
	else:
		raise Exception("Config file is missing the sources")


def format_properties(tmp_properties):
	properties = []
	for i, key in enumerate(tmp_properties):
		properties.append({"name": key})
		prop = properties[i]
		prop.update(tmp_properties[key])
		prop.pop("context", None)
		if "properties" in prop:
			prop["properties"] = format_properties(prop["properties"])

	return properties 