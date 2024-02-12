import argparse
import os.path
import shutil
import time
import sys

from detection.neo4j_import.neo4j_management import import_csv
from detection.run import traverse_graph

# MDG generator location
mdg_generator_path = os.path.join(os.getcwd(), "parser")


def parse_arguments():
    parser = argparse.ArgumentParser()
    # File path
    parser.add_argument("-f", "--file", type=str, required=True,
                        help="Path to JavaScript file (.js) or directory containing JavaScript files for analysis.")
    # Output path
    parser.add_argument("-o", "--output", type=str, default="graphjs-results",
                        help="Path to store all output files.")
    # Silent mode
    parser.add_argument("-s", "--silent", action="store_true",
                        help="Silent mode - no console output.")
    # Local or containerized mode (neo4j queries)
    parser.add_argument("-l", "--local", action="store_true",
                        help="Local query mode - executes neo4j locally instead of in a docker container.")
    # Generate exploits
    parser.add_argument("-e", "--exploit", action="store_true",
                        help="Generates symbolic tests.")
    return parser.parse_args()


def check_arguments():
    # Check if input file exists
    if not os.path.exists(args.file):
        sys.exit(f"Input file doesn't exist: ${args.file}")
    # Clean previous output files
    if os.path.exists(args.output):
        shutil.rmtree(args.output)
    # Create output folder
    os.mkdir(args.output)
    # Create graph output folder
    args.graph_output = os.path.abspath(os.path.join(args.output, "graph"))
    os.mkdir(args.graph_output)
    # Create run output folder (neo4j stats)
    args.run_output = os.path.abspath(os.path.join(args.output, "run"))
    os.mkdir(args.run_output)


def build_graphjs_cmd():
    abs_input_file = os.path.abspath(args.file) # Get absolute input file
    if args.silent:
        return f"npm start --prefix {mdg_generator_path} -- -f {abs_input_file} -o {args.graph_output} --csv --silent"
    else:
        return f"npm start --prefix {mdg_generator_path} -- -f {abs_input_file} -o {args.graph_output} --csv --graph --i=AST"


def run_queries():
    if args.local:
        # TODO
        # Stop running neo4j local instance
        # To use neo4j-admin import, it is required to stop, import and then start neo4j again
        print("[INFO] - Stopping Neo4j")
    else:
        # Import MDG to Neo4j
        import_csv(args.graph_output, args.run_output)
        # Perform graph traversals
        print("[INFO] Queries: Traversing Graph...")
        traverse_graph(f"{args.graph_output}/normalized.js",
                       f"{args.output}/taint_summary.json",
                       f"{args.run_output}/time_stats.txt",
                       args.exploit)


if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    check_arguments()

    # Build MDG
    graphjs_cmd = build_graphjs_cmd()
    print("[INFO] MDG: Generating...")
    os.system(graphjs_cmd)
    print("[INFO] MDG: Completed.")

    # Execute Graph Traversals (Queries)
    print("[INFO] Queries: Starting...")
    run_queries()
    print("[INFO] Queries: Completed.")

    # Exploit Generation
    ## Generate symbolic tests
