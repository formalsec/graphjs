import subprocess
import select
import sys
import re
from .neo4j_import.utils import timers


# Launches process
def launch_process(command: str, args: str, output_file=None):
	command_args = [command] + args.split(" ")
	process = subprocess.Popen(command_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
	result, _ = process.communicate()  # Wait for the process to finish and capture stdout and stderr
	result_decoded = result.decode("utf-8")

	# Save stdout and stderr to the output file
	if not output_file:
		print(result_decoded)
	else:
		with open(output_file, "w") as f:
			f.write(result_decoded)


# Launch process in background (with timeout)
def launch_process_bg(command: str, args: str, timeout, wait_for_output=None, output_file=None):
	command_args = [command] + args.split(" ")
	start_time = timers.start_timer()
	process = subprocess.Popen(command_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.PIPE)
	stdout = ""

	if wait_for_output:
		while True:
			ready, _, _ = select.select([process.stdout], [], [], timeout)
			if ready:
				line = process.stdout.readline().decode("utf-8")
				stdout += line
				if not line or wait_for_output in line:
					break
			else:
				sys.exit("[ERROR] Neo4j container was not successfully created (Timeout).")

	# Save stdout and stderr to the output file
	if not output_file:
		print(stdout)
	else:
		with open(output_file, "w") as f:
			f.write(stdout)


def measure_import_time(import_output_file, time_output):
	with open(import_output_file, 'r') as file:
		for line in file:
			if "IMPORT DONE in" in line:
				elapsed_time = re.search('IMPORT DONE in (.*)ms.', line).group(1)
				elapsed_time_ms = int(elapsed_time.split("s ")[0]) * 1000 + int(elapsed_time.split("s ")[1])

	print(f'import: {elapsed_time_ms}', file=open(time_output, 'a'))  # output to file
