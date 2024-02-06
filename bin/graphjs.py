import argparse
import os.path
import shutil


# MDG generator location
mdg_generator_path = os.path.join(os.path.dirname(os.getcwd()), "parser")


def parse_arguments():
    parser = argparse.ArgumentParser()
    # File path
    parser.add_argument("-f", "--file", type=str, required=True,
                        help="Path to JavaScript file (.js) or directory containing JavaScript files for analysis.")
    # Output path
    parser.add_argument("-o", "--output", type=str, default="../graphjs-results",
                        help="Path to store all output files.")
    # Silent mode
    parser.add_argument("-s", "--silent", action="store_true",
                        help="Silent mode - no console output.")
    return parser.parse_args()


def check_arguments():
    # Clean previous output files
    if os.path.exists(args.output):
        shutil.rmtree(args.output)
    # Create output folder
    os.mkdir(args.output)
    # Create graph output folder
    args.graph_output = os.path.join(args.output, "graph")
    os.mkdir(args.graph_output)


def build_graphjs_cmd():
    if args.silent:
        return f'''npm start --prefix {mdg_generator_path} -- -f {args.file} -o {args.graph_output} --csv --silent'''
    else:
        return f'''npm start --prefix {mdg_generator_path} -- -f {args.file} -o {args.graph_output} --csv --graph --i=AST'''


if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    check_arguments()

    # Build MDG
    graphjs_cmd = build_graphjs_cmd()
    os.system(graphjs_cmd)

    # Execute Graph Traversals (Queries)

    # Exploit Generation
    ## Generate symbolic tests
