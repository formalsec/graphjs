import argparse
import os.path
import shutil
import sys

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
                        help="Generates symbolic tests.")
    # Query type
    parser.add_argument("-q", "--query_type", type=str, choices=["bottom_up_greedy", "intra"],
                        default="intra", help="Selects the type of query to run.")


def parse_arguments():
    parser: argparse.ArgumentParser = argparse.ArgumentParser()
    add_arguments(parser)
    return parser.parse_args()


def check_arguments(file_path, output_path, graph_output, run_output, symbolic_tests_output, generate_exploit):
    # Check if input file exists
    if not os.path.exists(file_path):
        sys.exit(f"Input file doesn't exist: ${file_path}")
    # Clean previous output files
    if os.path.exists(output_path):
        for item in os.listdir(output_path):
            item_path = os.path.join(output_path, item)
            if os.path.isfile(item_path):
                os.remove(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
    else:
        os.makedirs(output_path)  # Create output folder
    os.mkdir(graph_output)  # Create graph output folder
    os.mkdir(run_output)  # Create run output folder (neo4j stats)
    if generate_exploit:
        os.mkdir(symbolic_tests_output)  # Create symbolic tests output folder


def build_graphjs_cmd(file_path, graph_output, silent=True):
    # os.system(f"tsc --project {parser_main_path}")  # Make sure graphjs is in the latest compiled version
    abs_input_file = os.path.abspath(file_path)  # Get absolute input file
    if silent:
        return ["node", f"{mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --silent"]
    else:
        return ["node", f"{mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --silent --graph --i=AST"]


def run_queries(file_path, graph_path, run_path, summary_path, time_path, generate_exploit, query_type):
    neo4j_management.import_csv_local(graph_path, run_path)
    print("[STEP 2] Queries: Imported")

    # Perform graph traversals
    print("[STEP 3] Queries: Traversing Graph...")
    detection.traverse_graph(file_path, summary_path, time_path, query_type, generate_exploit)


def run_graph_js(file_path, output_path, query_type, generate_exploit=False, silent=True):
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
    symbolic_tests_output = os.path.join(output_path, "symbolic_tests")
    check_arguments(file_path, output_path, graph_output, run_output, symbolic_tests_output, generate_exploit)

    # Build MDG
    graphjs_cmd = build_graphjs_cmd(file_path, graph_output, silent)
    print("[STEP 1] MDG: Generating...")
    start_time = timers.start_timer()
    utils.launch_process(graphjs_cmd[0], graphjs_cmd[1])
    timers.stop_timer(start_time, "graph", time_output)
    print("[STEP 1] MDG: Completed.")

    # Execute Graph Traversals (Queries)
    print("[STEP 2] Queries: Importing the graph...")
    run_queries(file_path, graph_output, run_output, summary_path, time_output, generate_exploit, query_type)
    print("[STEP 3] Queries: Completed.")

    # Generate symbolic tests
    if generate_exploit:
        print("[STEP 3] Symbolic test generation: Generating...")

        os.chdir(symbolic_tests_output)
        os.system(f"instrumentation2 {summary_path} {file_path}")
        print("[STEP 3] Symbolic test generation: Completed.")


if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    run_graph_js(args.file, args.output, args.query_type, args.exploit, args.silent)
