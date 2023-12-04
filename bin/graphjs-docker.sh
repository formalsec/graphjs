#!/bin/bash
shopt -s extglob

SCRIPT_DIR=$(dirname $(realpath $0))
ROOT_DIR=$(dirname $SCRIPT_DIR)
THIS_DIR=$PWD

# Import argument parsing functions
source "$SCRIPT_DIR"/parse_arguments.sh

# Check argument to single javascript source file
if [ -f "$CONFIGPATH" ] && [ -f "$FILEPATH" ]; then
    echo "Running Graph.js for $FILEPATH..."

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
          -g $GRAPH_DIR --csv --silent --graph --i=AST
    else
        npm start --prefix $ROOT_DIR/parser -- \
          -f $FILEPATH \
          -c $CONFIGPATH \
          -o $NORMALIZED \
          -g $GRAPH_DIR --csv --graph --i=AST 2>&1 | tee $NORM
    fi

    ### Query phase
    if [ $GRAPH_ONLY = false ]; then
        # get csv output to import dir in neo4j-custom dir
        NEO4J_DIR="$ROOT_DIR"/neo4j-custom

        # import cpg to neo4j
        NEO4J_GRAPHJS_DIR_CONTAINER=neo4j-graphjs

        ## Import CPG to Neo4j
        $NEO4J_DIR/run_neo4j.sh $GRAPH_DIR $NEO4J_GRAPHJS_DIR_CONTAINER
        [ $? -ne 0 ] && exit 1

        # run all queries
        echo "[INFO] - Running queries"
        QUERIES="$ROOT_DIR"/detection
        python3 $QUERIES/run.py -f $NORMALIZED -o $TAINT_SUMMARY

        # stop Neo4J container
        echo "[INFO] - Stopping and removing container $NEO4J_GRAPHJS_DIR_CONTAINER"
        docker stop $NEO4J_GRAPHJS_DIR_CONTAINER

        # Create an exploit
        if $EXPLOIT; then
            # Create symbolic tests
            echo "[INFO] - Creating symbolic tests"
            INST=$ROOT_DIR/instrumentation/src/instrumenter.js
            node $INST -i $NORMALIZED -c $TAINT_SUMMARY -o $SYMBOLIC_TEST
        fi
    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] || [[ -d $string && $string != *graphjs ]]; then
            "$SCRIPT_DIR"/graphjs-docker.sh \
              -xf $file \
              -c config.json \
              -e "${file}_graphjs"
        fi
    done
else
    Help
fi
