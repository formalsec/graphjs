#!/usr/bin/env python3
import argparse
import os.path
import pathlib
import shutil
import sys
import json

script = pathlib.Path(__file__).resolve()
project_dir = script.parent.absolute()

sys.path.insert(0, str(project_dir))
sys.path.append(str(project_dir))

if "PYTHONPATH" not in os.environ:
    os.environ["PYTHONPATH"] = ""
os.environ["PYTHONPATH"] += os.pathsep + str(project_dir)

import detection.neo4j_import.neo4j_management as neo4j_management
import detection.neo4j_import.utils.timers as timers
import detection.run as detection
import detection.utils as utils
import constants

# MDG generator location
mdg_generator_path = constants.MDG_PATH
# Default results location
graphjs_results = constants.DEFAULT_RESULTS_PATH
# MDG parser main location (parent folder)
parser_main_path = constants.PARSER_PATH


def add_arguments(parser: argparse.ArgumentParser) -> None:

    # File path
    parser.add_argument("-f", "--file", type=str, required=True,
                        help="Path to JavaScript file (.js) or directory containing JavaScript files for analysis.")
    # Output path
    parser.add_argument("-o", "--output", type=str,
                        help="Path to store all output files.")
    # Silent mode
    parser.add_argument("-s", "--silent", action="store_true",
                        help="Silent mode - does not save graph .svg.")
    # Generate exploits
    parser.add_argument("-e", "--exploit", action="store_true",
                        help="Generates symbolic tests (implies --with-types).")
    # Query type
    parser.add_argument("-q", "--query_type", type=str, choices=["bottom_up_greedy", "intra"],
                        default="bottom_up_greedy", help="Selects the type of query to run.")
    # Generate taint summary with type information
    parser.add_argument("--with-types", dest="with_types", action="store_true",
                        help="Generates taint_summary with type information.")
    # Allow dirty output directories
    parser.add_argument("--dirty", dest="dirty", action="store_true",
                        help="Don't clean output dir if it exists.")
    parser.add_argument("--optimized-import", dest="optimized", action="store_true",
                        help="Try optimized import without stopping neo4j")




def parse_arguments():
    parser: argparse.ArgumentParser = argparse.ArgumentParser()
    add_arguments(parser)
    return parser.parse_args()


# If the input is a directory, get the package entry file
def get_index_file(file_path):
    if os.path.isdir(file_path):
        # Directory contains a package.json file
        if os.path.exists(os.path.join(file_path, "package.json")):
            with open(os.path.join(file_path, "package.json"), "r") as f:
                package_json = json.load(f)

                # Get the main field
                main = package_json.get("main", None)
                if main:
                    main = os.path.normpath(main)
                    # Check if it has a file extension
                    if not main.endswith(".js") and not main.endswith(".mjs") and not main.endswith(".cjs"):
                        main += ".js"
                    # Check if main is a directory with only one file
                    if os.path.isdir(os.path.join(file_path, main)):
                        main_files = os.listdir(os.path.join(file_path, main))
                        if len(main_files) == 1:
                            main = os.path.join(main, main_files[0])
                    print(f"Using main file: {main}")
                    return os.path.join(file_path, main)

        # No package.json file, check for default entry file
        print(f"No 'main' field found. Looking for default entry point...")

        # List of possible locations where the main file might be
        possible_files = [
            'index.js',  # Default main file
            'lib/index.js',  # Common folder for libraries
            'src/index.js',  # Common folder for source files
            'dist/index.js'  # Common folder for distribution files
        ]

        for file in possible_files:
            file_path = os.path.join(file_path, file)
            if os.path.exists(file_path):
                print(f"Found default entry point: {file}")
                return file_path

        # If no default entry point is found, exit
        sys.exit(f"No default entry point found in directory: ${file_path}")


def check_arguments(file_path, output_path, graph_output, run_output, dirty):
    # Check if input file exists
    if not os.path.exists(file_path):
        sys.exit(f"Input file doesn't exist: ${file_path}")
    # Clean previous output files
    if os.path.exists(output_path) and not dirty:
        for item in os.listdir(output_path):
            item_path = os.path.join(output_path, item)
            if os.path.isfile(item_path):
                os.remove(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
    else:
        os.makedirs(output_path, exist_ok=True)  # Create output folder
    if not os.path.exists(graph_output):
        os.mkdir(graph_output)  # Create graph output folder
    if not os.path.exists(run_output):
        os.mkdir(run_output)  # Create run output folder (neo4j stats)


def build_graphjs_cmd(file_path, graph_output, silent=True):
    # os.system(f"tsc --project {parser_main_path}")  # Make sure graphjs is in the latest compiled version
    abs_input_file = os.path.abspath(file_path)  # Get absolute input file
    if silent:
        return ["node", f"{mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --silent"]
    else:
        return ["node", f"{mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --silent --graph --i=AST"]


def run_queries(file_path, graph_path, run_path, summary_path, time_path,
                generate_exploit, query_type, optimized):
    if not optimized:
        neo4j_management.import_csv_local(graph_path, run_path)
        print("[STEP 2] Queries: Imported")

    # Perform graph traversals
    print("[STEP 3] Queries: Traversing Graph...")
    detection.traverse_graph(
        graph_path,
        file_path,
        summary_path,
        time_path,
        query_type,
        generate_exploit,
        optimized=optimized
    )


def run_graph_js(file_path, output_path, query_type, with_types=False, generate_exploit=False, silent=True, dirty=False, optimized=False):
    # Get absolute paths
    file_path = os.path.abspath(file_path)
    # Generate default output path
    if output_path is None:
        output_path = os.path.abspath(os.path.join(os.path.basename(file_path), "tool_outputs/graphjs"))
    else:
        output_path = os.path.abspath(output_path)
    graph_output = os.path.join(output_path, "graph")
    run_output = os.path.join(output_path, "run")
    time_output = os.path.join(run_output, "time_stats.txt")
    summary_path = os.path.join(output_path, "taint_summary.json")
    check_arguments(file_path, output_path, graph_output, run_output, dirty)

    # If file_path is a directory, get the package index file
    if os.path.isdir(file_path):
        file_path = get_index_file(file_path)

    # Build MDG
    graphjs_cmd = build_graphjs_cmd(file_path, graph_output, silent)
    print("[STEP 1] MDG: Generating...")
    start_time = timers.start_timer()
    utils.launch_process(graphjs_cmd[0], graphjs_cmd[1])
    timers.stop_timer(start_time, "graph", time_output)
    print("[STEP 1] MDG: Completed.")

    # Execute Graph Traversals (Queries)
    print("[STEP 2] Queries: Importing the graph...")
    run_queries(file_path, graph_output, run_output, summary_path, time_output,
                (with_types or generate_exploit), query_type, optimized)
    print("[STEP 3] Queries: Completed.")


if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    run_graph_js(args.file, args.output, args.query_type, args.with_types, args.exploit, args.silent, args.dirty, args.optimized)
