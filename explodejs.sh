#!/bin/bash

THIS_DIR=$(realpath "$0")

Help()
{
    # Display Help
    echo "Run Explode.js CPG construction and query execution stages."
    echo
    echo "Syntax: explodejs.sh [-f|-c|-o|-t|-n|-x|s|h]"
    echo "options:"
    echo "f     Path to JavaScript file (.js) for analysis."
    echo "c     Path to JSON file (.json) containing the unsafe sinks."
    echo "o     Path to Explode.js taint summary file (.json)."
    echo "t     Path to Explode.js symbolic test (.js)."
    echo "n     Path to normalization output file."
    echo "x     Create an exploit."
    echo "s     Silent mode - no console output."
    echo "h     Print this Help."
    echo
}

# Default values
TAINT_SUMMARY="taint_summary.json"
SYMBOLIC_TEST="symbolic_test.js"
EXPLOIT=false
SILENT_OP=false
GRAPH_ONLY=false

# process arguments
while getopts f:c:o:t:n:xsgh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        o) TAINT_SUMMARY=$OPTARG;;
        t) SYMBOLIC_TEST=$OPTARG;;
        n) NORM=$OPTARG;;
        x) EXPLOIT=true;;
        s) SILENT_OP=true;;
        g) GRAPH_ONLY=true;;
        h) #display Help
            Help
            exit;;
    esac
done

# check argument to single javascript source file
if test -f "$FILEPATH"; then
    ABS_INPUT_FILE=$(realpath $FILEPATH)
    ABS_CONFIG_FILE=$(realpath $CONFIGPATH)

    # run cpg construction stage and serialize cpg
    if [ $SILENT_OP = true ]; then
        npm start --prefix parser -- -f $ABS_INPUT_FILE -c $ABS_CONFIG_FILE --out --csv
    else
        npm start --prefix parser -- -f $ABS_INPUT_FILE -c $ABS_CONFIG_FILE --out --csv 2>&1 | tee $NORM
    fi

    if [ $GRAPH_ONLY = false ]; then
        # get csv output to import dir in neo4j-custom dir
        NEO4J_DIR=$(realpath ./neo4j-custom)
        CPG_ORIGINAL_DIR=$(realpath ./parser/src/graphs)
        NEO4J_IMPORT_DIR=$(realpath ./neo4j-custom/import-files)
        cp $CPG_ORIGINAL_DIR/graph_nodes.csv $NEO4J_IMPORT_DIR/nodes.csv
        cp $CPG_ORIGINAL_DIR/graph_rels.csv $NEO4J_IMPORT_DIR/rels.csv

        # import cpg to neo4j
        NEO4J_EXPLODEJS_CONTAINER=neo4j-explodejs
        cd $NEO4J_DIR
        if [ $SILENT_OP = true ]; then
            $NEO4J_DIR/run_neo4j.sh $NEO4J_IMPORT_DIR
        else
            $NEO4J_DIR/run_neo4j.sh $NEO4J_IMPORT_DIR
        fi
        cd $(dirname $THIS_DIR)

        # run all queries
        echo "[INFO] - Running queries"
        QUERIES=$(realpath ./detection)
        python3 $QUERIES/run.py $FILEPATH $TAINT_SUMMARY

        # stop Neo4J container
        echo "[INFO] - Stopping and removing container $NEO4j_EXPLODEJS_CONTAINER"
        docker stop $NEO4J_EXPLODEJS_CONTAINER

        # Create an exploit
        if $EXPLOIT; then
            echo "[INFO] - Creating exploit"
            
            # create symbolic tests
            echo "[INFO] - Creating symbolic tests"
            NORMALIZED_FILEPATH=${FILEPATH/.js/-normalized.js}
            node instrumentation/src/instrumenter.js -i $NORMALIZED_FILEPATH -c $TAINT_SUMMARY -o $SYMBOLIC_TEST
        fi

    fi

    # output result to command line and serialize results
else
    Help
fi
