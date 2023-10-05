#!/bin/bash
shopt -s extglob

ROOT_DIR=$(dirname $PWD)
THIS_DIR=$PWD

# Import argument parsing functions
source "$ROOT_DIR"/scripts/utils/parse_arguments.sh

# Check argument to single javascript source file
if [ -f "$CONFIGPATH" ] && [ -f "$FILEPATH" ]; then
    echo "Running Explode.js for $FILEPATH"

    # Clean Explode.js output if it exists
    if [ -d "$EXPLODEJS_DIR" ] ; then
        rm -rf "$EXPLODEJS_DIR"/!(*expected_output.json)
    else
        mkdir -p $EXPLODEJS_DIR 
    fi

    # Create graph outputs dir
    mkdir -p $GRAPH_DIR

    # Default values
    FILEPATH=$(realpath $FILEPATH)
    CONFIGPATH=$(realpath $CONFIGPATH)

    ### CPG construction Stage
    echo "[INFO] - Generating graph"
    if [ $SILENT_OP = true ]; then
        npm start -s --prefix ../parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --silent --graph --i=AST
    else
        npm start --prefix ../parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --graph --i=AST --sc  2>&1 | tee $NORM
    fi

    ### Query phase
    if [ $GRAPH_ONLY = false ]; then
        cd ${ROOT_DIR}

        ## Stop running neo4j local instance
        # To use neo4j-admin import, it is required to stop, import and then start neo4j again
        NEO4J_DIR=$(realpath ./neo4j-custom)
        cd $NEO4J_DIR
        echo "[INFO] - Stopping Neo4j"
        neo4j stop &> neo4j_stop.txt

        ## Import CPG to Neo4j
        echo "[INFO] - Importing Neo4j"
        neo4j-admin database import full --overwrite-destination --nodes="$GRAPH_DIR/nodes.csv" --relationships="$GRAPH_DIR/rels.csv" --delimiter='¿' --skip-bad-relationships=true --skip-duplicate-nodes=true --high-parallel-io=on &> neo4j_import.txt

        ## Start neo4j instance
        echo "[INFO] - Starting Neo4j"
        neo4j console &> neo4j_start.txt &
        until (cat neo4j_start.txt | grep "Started"); do sleep 0.5; done; # Waits until instance has started

        ## Run queries stage
        echo "[INFO] - Running queries."
        QUERIES=$(realpath ../detection)
        python3 $QUERIES/run.py -f $NORMALIZED -o $TAINT_SUMMARY 2> "$EXPLODEJS_DIR/query_times.txt"
    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] || [[ -d $string && $string != *explodejs ]]; then
            ./explodejs-local.sh -xf $file -c config.json -e "${file}_explodejs"
        fi
    done
else
    Help
fi
