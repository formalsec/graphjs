#!/bin/bash
shopt -s extglob

SCRIPT_DIR=$(dirname $0)
ROOT_DIR=$(dirname $SCRIPT_DIR)

# Import argument parsing functions
source "$SCRIPT_DIR"/parse_arguments.sh

# Check argument to single javascript source file
if [ -f "$CONFIGPATH" ] && [ -f "$FILEPATH" ]; then
    echo "Running Graph.js for $FILEPATH"

    # Clean Graph.js output if it exists
    if [ -d "$GRAPHJS_DIR" ] ; then
        rm -rf "$GRAPHJS_DIR"/!(*expected_output.json)
    else
        mkdir -p $GRAPHJS_DIR
    fi

    # Create graph outputs dir
    mkdir -p $GRAPH_DIR

    # Default values
    FILEPATH=$(realpath $FILEPATH)
    CONFIGPATH=$(realpath $CONFIGPATH)

    ### CPG construction Stage
    echo "[INFO] - Generating graph"
    if [ $SILENT_OP = true ]; then
        npm start -s --prefix ../parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --silent
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
        python3 $QUERIES/run.py -f $NORMALIZED -o $TAINT_SUMMARY 2> "$GRAPHJS_DIR/time_stats.txt"
    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] || [[ -d $string && $string != *graphjs ]]; then
            ./graph-local.sh -xf $file -c config.json -e "${file}_graphjs"
        fi
    done
else
    Help
fi
