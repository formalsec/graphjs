#!/bin/bash
shopt -s extglob

SCRIPT_DIR=$(dirname $(realpath $0))
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
        npm start -s --prefix $ROOT_DIR/parser -- \
          -f $FILEPATH \
          -c $CONFIGPATH \
          -o $NORMALIZED \
          -g $GRAPH_DIR --csv --silent
    else
        npm start --prefix $ROOT_DIR/parser -- \
          -f $FILEPATH \
          -c $CONFIGPATH \
          -o $NORMALIZED \
          -g $GRAPH_DIR --csv --graph --i=AST  2>&1 | tee $NORM
    fi

    ### Query phase
    if [ $GRAPH_ONLY = false ]; then
        ## Stop running neo4j local instance
        # To use neo4j-admin import, it is required to stop, import and then start neo4j again
        NEO4J_DIR=$ROOT_DIR/neo4j-custom
        echo "[INFO] - Stopping Neo4j"
        NEO4J_STOP=$GRAPHJS_DIR/neo4j_stop.txt
        neo4j stop &> $NEO4J_STOP

        ## Import CPG to Neo4j
        echo "[INFO] - Importing Neo4j"
        NEO4J_IMPORT=$GRAPHJS_DIR/neo4j_import.txt
        neo4j-admin database import full --overwrite-destination \
          --nodes="$GRAPH_DIR/nodes.csv" \
          --relationships="$GRAPH_DIR/rels.csv" \
          --delimiter='¿' \
          --skip-bad-relationships=true \
          --skip-duplicate-nodes=true \
          --high-parallel-io=on &> $NEO4J_IMPORT

        ## Start neo4j instance
        echo "[INFO] - Starting Neo4j"
        NEO4J_START=$GRAPHJS_DIR/neo4j_start.txt
        neo4j console &> $NEO4J_START &
        until (cat $NEO4J_START | grep "Started"); do sleep 0.5; done; # Waits until instance has started

        ## Run queries stage
        echo "[INFO] - Running queries."
        QUERIES=$ROOT_DIR/detection
        python3 $QUERIES/run.py -f $NORMALIZED -o $TAINT_SUMMARY \
          2> "$GRAPHJS_DIR/time_stats.txt"

        # Create an exploit
        if $EXPLOIT; then
            # Create symbolic tests
            echo "[INFO] - Creating symbolic tests"
            cd "$GRAPHJS_DIR" || exit
            instrumentation2 $FILEPATH $TAINT_SUMMARY
        fi
    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] \
          || [[ -d $string && $string != *graphjs ]]; then
            $SCRIPT_DIR/graph-local.sh \
              -xf $file \
              -c config.json \
              -e "${file}_graphjs"
        fi
    done
else
    Help
fi
