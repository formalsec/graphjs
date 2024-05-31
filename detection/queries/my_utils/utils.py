from os import path
import json
from pprint import pprint
import linecache


def console(s, debug=True):
	if debug:
		try:
			print(json.dumps(s, indent=4))
		except:
			pprint(s)


def save_output(vuln_paths, output_file):
	with open(output_file, "w", encoding='utf-8') as f:
		f.write(json.dumps(vuln_paths, indent=4) + '\n')


def init_intermediate_output(output_file):
	with open(output_file, "w", encoding='utf-8') as f:
		f.write(json.dumps([], indent=4) + '\n')


def save_intermediate_output(vuln_path, output_file):
	if path.exists(output_file):
		f = open(output_file)
		vuln_paths = json.load(f)
		f.close()
	else:
		vuln_paths = []

	if vuln_path not in vuln_paths:
		del vuln_paths["sink_function"]
		vuln_paths.append(vuln_path)

	with open(output_file, "w", encoding='utf-8') as f:
		f.write(json.dumps(vuln_paths, indent=4) + '\n')


def save_output_multi_files(argv, results):
	if len(argv) >= 2:
		output = argv[1]
		for i in range(len(results)):
			# with open(f"{output}.{i}.exjs", "w") as f:
			with open(f"{output}.{i}.exjs", "w", encoding='utf-8') as f:
				f.write(json.dumps(results[i], indent=4) + '\n')


def read_config():
	file_path = path.realpath(path.dirname(__file__))
	config_path = path.join(file_path, "../../../config.json")
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


def get_sinks_from_config(config):
	if "sinks" in config:
		sinks = []
		for injection_type in config["sinks"].values():
			for sink in injection_type:
				sinks.append(sink["sink"])
		return sinks
	else:
		raise Exception("Config file is missing the sinks")


def get_all_sources_from_config(config):
	if "sources" in config:
		return config["sources"]
	else:
		raise Exception("Config file is missing the sources")


def get_built_in_functions(config):
	if "sinks" in config:
		sinks = []
		for injection_type in config["sinks"].values():
			for sink in injection_type:
				sinks.append(sink["sink"])
		return sinks
	else:
		raise Exception("Config file is missing the sinks")


def get_injection_type(sink, config) -> str:
	if "sinks" in config:
		for injection_type, vulns in config["sinks"].items():
			for vuln in vulns:
				if vuln["sink"] == sink:
					return injection_type
	else:
		raise Exception("Config file is missing the sinks")


def get_code_line_from_file(filename, lineno):
	line = linecache.getline(filename, lineno)
	return line.lstrip().replace("\n", "")


def format_name(input_str):
	parts = input_str.split('.')
	desired_words = []
	for part in parts:
		if part.startswith('-o'):
			break
		elif part[0].isdigit():
			continue
		desired_words.append(part.split('-')[0])
	return '.'.join(desired_words)
