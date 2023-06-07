#!/bin/bash

THIS_DIR=$(realpath "$0")
NEO4J_CMD=/opt/homebrew/Cellar/neo4j/5.8.0/bin/neo4j
NEO4J_ADMIN_CMD=/opt/homebrew/Cellar/neo4j/5.8.0/bin/neo4j-admin

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

# process arguments
while getopts f:c:o:n:sh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        o) OUTPUT=$OPTARG;;
        n) NORM=$OPTARG;;
        s) SILENT_OP=true;;
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

    # get csv output to import dir in neo4j-custom dir
    NEO4J_DIR=$(realpath ./neo4j-custom)
    CPG_ORIGINAL_DIR=$(realpath ./parser/src/graphs)
    NEO4J_IMPORT_DIR=$(realpath ./neo4j-custom/import-files)
    cp $CPG_ORIGINAL_DIR/graph_nodes.csv $NEO4J_IMPORT_DIR/nodes.csv
    cp $CPG_ORIGINAL_DIR/graph_rels.csv $NEO4J_IMPORT_DIR/rels.csv

    # import cpg to neo4j
    cd $NEO4J_DIR
    $NEO4J_CMD stop
    $NEO4J_ADMIN_CMD database import full --overwrite-destination --nodes=import-files/nodes.csv --relationships=import-files/rels.csv --delimiter='¿' --skip-bad-relationships=true --skip-duplicate-nodes=true > /dev/null
    $NEO4J_CMD console > neo4j_start.txt &
    until (cat neo4j_start.txt | grep "Started"); do sleep 5; done;

    cd $(dirname $THIS_DIR)

    # run all queries
    echo "[INFO] - Running queries for $FILEPATH"
    QUERIES=$(realpath ./detection)
    python3 $QUERIES/run.py -f $FILEPATH -o $OUTPUT

else
    Help
fi
