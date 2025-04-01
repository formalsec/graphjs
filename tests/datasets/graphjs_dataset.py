from pathlib import Path
import sys
from glob import glob
import os
import argparse
from func_timeout import func_timeout, FunctionTimedOut
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CWES = ["CWE-22", "CWE-78", "CWE-94", "CWE-1321"]   # CWEs to be analyzed
TIMEOUT = 300
DATASET_PATH = Path("datasets")
# GRAPHJS_PATH = os.path.abspath(evaluation_config['GraphjsPath'])  # Graph.js path
# GRAPHJS_CMD = os.path.abspath(evaluation_config['GraphjsCmd'])  # Graph.js command
# sys.path.append(GRAPHJS_PATH)


def get_cwes_to_be_analyzed(types):
    if types == "all":
        return CWES
    elif types == "path-traversal":
        return ["CWE-22"]
    elif types == "command-execution":
        return ["CWE-78"]
    elif types == "code-injection":
        return ["CWE-94"]
    elif types == "prototype-pollution":
        return ["CWE-471"]
    else:
        sys.exit(f"Vulnerability type provided ({types}) did not match the expected.")


def run_graphjs(vuln_file, graphjs_path):
    os.system(f"python3 graphjs -f {vuln_file} -s -o {graphjs_path} {'-e' if args.e else ''}")


def get_all_input_files(src_advisory, package_level):
    if package_level:
        return [""]
    
    input_files = []
    for root, dirs, files in os.walk(src_advisory):
        for file in files:
            file_path = os.path.join(root, file)
            if file.endswith('.js'):
                input_files.append(os.path.relpath(file_path, src_advisory))
    return input_files


def run_graphjs_dataset(package_level):
    count = 0
    logger.info("Running Graph.js for advisories in %s", DATASET)
    # Get all advisories
    advisories = sorted(glob(str(DATASET)))
    for advisory in advisories:
        count += 1
        logger.info("Processing advisory (%d/%d): %s", count, len(advisories), advisory)

        # Get source files in advisory package
        src = os.path.join(advisory, "src")
        if not os.path.exists(src):
            continue

        for src_file in get_all_input_files(src, package_level):
            vuln_file = os.path.join(src, src_file)

            # Get output file paths
            graphjs_output_path = os.path.join(advisory, f"tool_outputs/{src_file}_graphjs")
            if not os.path.exists(graphjs_output_path):
                os.makedirs(graphjs_output_path, exist_ok=True)

            # Run graphjs with timeout
            try:
                func_timeout(TIMEOUT, run_graphjs, args=(vuln_file, graphjs_output_path))
                print("Analysis successful.")
            except FunctionTimedOut:
                print("Analysis timed out.")
                os.system("neo4j stop")
                time_output_file = os.path.join(graphjs_output_path, "run/time_stats.txt")
                f = open(time_output_file, "a")
                f.write("\nTimed out\n")
                f.close()


if __name__ == "__main__":
    # Parse arguments
    parser = argparse.ArgumentParser()
    parser.add_argument("-d", type=str, required=True, choices=["vulcan", "secbench", "collected", "test", "zeroday"])
    parser.add_argument("-v", type=str, required=False, choices=["path-traversal", "command-execution",
                                                                "code-injection", "prototype-pollution", "all"])
    parser.add_argument("-e", action="store_true")  # Generates extended taint summary
    parser.add_argument("-p", action="store_true")  # Only runs package level
    args = parser.parse_args()

    selected_cwes = get_cwes_to_be_analyzed(args.v)
    for cwe in selected_cwes:
        if args.d == "vulcan":
            DATASET = DATASET_PATH / "vulcan-dataset" / cwe /"*"
        elif args.d == "secbench":
            DATASET = os.path.join("secbench-dataset", cwe, "*")
        elif args.d == "collected":
            DATASET = os.path.join("collected-dataset", cwe, "*")
        elif args.d == "test":
            DATASET = os.path.join("test-dataset", cwe, "*")
        if args.d == "zeroday":
            DATASET = os.path.join("zeroday", "*")
        run_graphjs_dataset(args.p)
