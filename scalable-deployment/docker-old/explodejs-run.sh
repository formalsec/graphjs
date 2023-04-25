#!/bin/bash

THIS_DIR=$(realpath "$0")

Help()
{
    # Display Help
    echo "Run Explode.js CPG construction and query execution stages."
    echo
    echo "Syntax: explodejs.sh [-f|-o|s|h]"
    echo "options:"
    echo "f     Path to JavaScript file for analysis."
    echo "c     Path to JSON file containing the unsafe sinks."
    echo "o     Path to Explode.js output file."
    echo "n     Path to normalization output file."
    echo "s     Silent mode - no console output."
    echo "h     Print this Help."
    echo
}

SILENT_OP=false
GRAPH_ONLY=false
FILE_TO_TEST=true

# process arguments
while getopts f:c:o:n:sgh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        o) OUTPUT=$OPTARG;;
        n) NORM=$OPTARG;;
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
        npm start --prefix parser -- -f $ABS_INPUT_FILE -c $ABS_CONFIG_FILE --csv
    else
        npm start --prefix parser -- -f $ABS_INPUT_FILE -c $ABS_CONFIG_FILE --csv 2>&1 | tee $NORM

        if grep -e 'Error: [A-Za-z]*Error' $NORM; then
            FILE_TO_TEST=false
        fi
    fi

    if [[ $GRAPH_ONLY = false && $FILE_TO_TEST = true ]]; then
        # import cpg to neo4j
        CPG_ORIGINAL_DIR=$(realpath ./parser/src/graphs)
        NEO4J_DIR="/var/lib/neo4j"

        chown -R neo4j:neo4j $CPG_ORIGINAL_DIR

        cd $NEO4J_DIR
        neo4j stop
        neo4j-admin import --nodes=$CPG_ORIGINAL_DIR/graph_nodes.csv --relationships=$CPG_ORIGINAL_DIR/graph_rels.csv --delimiter='¿' --skip-bad-relationships=true --skip-duplicate-nodes=true
        # ( tail -f -n0 `neo4j console` & ) | grep -q "Started."
        neo4j start
        while ! grep -q Started /var/lib/neo4j/logs/neo4j.log; do
            sleep 1
        done

        cd $(dirname $THIS_DIR)

        # run all queries
        echo "[INFO] - Running queries"
        QUERIES=$(realpath ./detection)
        python3 $QUERIES/run.py $FILEPATH $OUTPUT
    fi

    # output result to command line and serialize results
else
    Help
fi
