#!/bin/bash

THIS_DIR=$(realpath "$0")

Help()
{
    # Display Help
    echo "Run Explode.js CPG construction and query execution stages."
    echo
    echo "Syntax: explodejs.sh [-f|s|h]"
    echo "options:"
    echo "f     Path to JavaScript file for analysis."
    echo "s     Silent mode - no console output."
    echo "h     Print this Help."
    echo
}

SILENT_OP=false

# process arguments
while getopts f:sh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        s) SILENT_OP=true;;
        h) #display Help
            Help
            exit;;
    esac
done

# check argument to single javascript source file
if test -f "$FILEPATH"; then
    ABS_INPUT_FILE=$(realpath $FILEPATH)

    # run cpg construction stage and serialize cpg
    if [ $SILENT_OP = true ]; then
        npm start --prefix ./parser -- $ABS_INPUT_FILE --csv > '/dev/null' 2>&1
    else
        npm start --prefix ./parser -- $ABS_INPUT_FILE --csv
    fi
fi

# get csv output to import dir in neo4j-custom dir
NEO4J_DIR=$(realpath ./neo4j-custom)
CPG_ORIGINAL_DIR=$(realpath ./parser/src/graphs)
NEO4J_IMPORT_DIR=$(realpath ./neo4j-custom/import-files)
cp $CPG_ORIGINAL_DIR/graph_nodes.csv $NEO4J_IMPORT_DIR/nodes.csv
cp $CPG_ORIGINAL_DIR/graph_rels.csv $NEO4J_IMPORT_DIR/rels.csv

# import cpg to neo4j
# . $NEO4J_DIR/.config
cd $NEO4J_DIR
$NEO4J_DIR/run_neo4j.sh $NEO4J_IMPORT_DIR
cd $THIS_DIR

# run all queries

# output result to command line and serialize results