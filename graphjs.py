import argparse
import os.path
import shutil
import sys

from detection.neo4j_import.neo4j_management import import_csv_docker, import_csv_local
from detection.neo4j_import.utils import timers
from detection.run import traverse_graph
import constants

# MDG generator location
mdg_generator_path = constants.MDG_PATH
# Default results location
graphjs_results = constants.DEFAULT_RESULTS_PATH
# MDG parser main location (parent folder)
parser_main_path = constants.PARSER_PATH


def parse_arguments():
    parser = argparse.ArgumentParser()
    # File path
    parser.add_argument("-f", "--file", type=str, required=True,
                        help="Path to JavaScript file (.js) or directory containing JavaScript files for analysis.")
    # Output path
    parser.add_argument("-o", "--output", type=str, default=graphjs_results,
                        help="Path to store all output files.")
    # Silent mode
    parser.add_argument("-s", "--silent", action="store_true",
                        help="Silent mode - no console output.")
    # Local or containerized mode (neo4j queries)
    parser.add_argument("-d", "--docker", action="store_true",
                        help="Query mode - executes neo4j in a docker container instead of running locally.")
    # Generate exploits
    parser.add_argument("-e", "--exploit", action="store_true",
                        help="Generates symbolic tests.")
    return parser.parse_args()


def check_arguments(file_path, output_path, graph_output, run_output, symb_tests_output):
    # Check if input file exists
    if not os.path.exists(file_path):
        sys.exit(f"Input file doesn't exist: ${file_path}")
    # Clean previous output files
    if os.path.exists(output_path):
        shutil.rmtree(output_path)

    os.mkdir(output_path)  # Create output folder
    os.mkdir(graph_output)  # Create graph output folder
    os.mkdir(run_output)  # Create run output folder (neo4j stats)
    if args.exploit:
        os.mkdir(symb_tests_output)  # Create symbolic tests output folder


def build_graphjs_cmd(file_path, graph_output):
    os.system(f"tsc --project {parser_main_path}")  # Make sure graphjs is in the latest compiled version
    abs_input_file = os.path.abspath(file_path)  # Get absolute input file
    if args.silent:
        return f"node {mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --silent"
    else:
        return f"node {mdg_generator_path} -f {abs_input_file} -o {graph_output} --csv --graph --i=AST"


def run_queries(graph_path, run_path, summary_path, time_path):
    # Import MDG to Neo4j
    if args.docker:
        import_csv_docker(graph_path, run_path)
    else:
        import_csv_local(graph_path, run_path)

    # Perform graph traversals
    print("[INFO] Queries: Traversing Graph...")
    traverse_graph(f"{graph_path}/normalized.js",
                   summary_path,
                   time_path,
                   args.exploit)


def run_graph_js(file_path, output_path):
    # Get absolute paths
    file_path = os.path.abspath(file_path)
    output_path = os.path.abspath(output_path)
    graph_output = os.path.join(output_path, "graph")
    run_output = os.path.join(output_path, "run")
    time_output = os.path.join(run_output, "time_stats.txt")
    summary_path = os.path.join(output_path, "taint_summary.json")
    symb_tests_output = os.path.join(output_path, "symbolic_tests")
    check_arguments(file_path, output_path, graph_output, run_output, symb_tests_output)

    # Build MDG
    graphjs_cmd = build_graphjs_cmd(file_path, graph_output)
    print("[INFO] MDG: Generating...")
    start_time = timers.start_timer()
    os.system(graphjs_cmd)
    timers.stop_timer(start_time, "graph", time_output)
    print("[INFO] MDG: Completed.")

    # Execute Graph Traversals (Queries)
    print("[INFO] Queries: Starting...")
    run_queries(graph_output, run_output, summary_path, time_output)
    print("[INFO] Queries: Completed.")

    # Generate symbolic tests
    if args.exploit:
        print("[INFO] Symbolic test generation: Generating...")

        os.chdir(symb_tests_output)
        os.system(f"instrumentation2 {file_path} {summary_path}")
        print("[INFO] Symbolic test generation: Completed.")


if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    run_graph_js(args.file, args.output)
