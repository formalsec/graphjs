#!/bin/bash
shopt -s extglob

ROOT_DIR=$(dirname $PWD)
THIS_DIR=$PWD

# Import argument parsing functions
source "$ROOT_DIR"/scripts/utils/parse_arguments.sh

# Check argument to single javascript source file
if [ -f "$CONFIGPATH" ] && [ -f "$FILEPATH" ]; then
    echo "Running Explode.js for $FILEPATH..."

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
        npm start -s --prefix ../parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --silent --graph --i=AST --sc
    else
        npm start --prefix ../parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --graph --i=AST --sc 2>&1 | tee $NORM
    fi

    ### Query phase
    if [ $GRAPH_ONLY = false ]; then
        cd ${ROOT_DIR}

        # get csv output to import dir in neo4j-custom dir
        NEO4J_DIR=$(realpath ./neo4j-custom)

        # import cpg to neo4j
        NEO4J_EXPLODEJS_CONTAINER=neo4j-explodejs
        cd $NEO4J_DIR

        ## Import CPG to Neo4j
        $NEO4J_DIR/run_neo4j.sh $GRAPH_DIR

        cd $(dirname $THIS_DIR)

        # run all queries
        echo "[INFO] - Running queries"
        QUERIES=$(realpath ./detection)
        python3 $QUERIES/run.py -f $NORMALIZED -o $TAINT_SUMMARY

        # stop Neo4J container
        echo "[INFO] - Stopping and removing container $NEO4j_EXPLODEJS_CONTAINER"
        docker stop $NEO4J_EXPLODEJS_CONTAINER

        # Create an exploit
        if $EXPLOIT; then
            echo "[INFO] - Creating exploit"
            
            # Create symbolic tests
            echo "[INFO] - Creating symbolic tests"
            node instrumentation/src/instrumenter.js -i $NORMALIZED -c $TAINT_SUMMARY -o $SYMBOLIC_TEST
        fi

    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] || [[ -d $string && $string != *explodejs ]]; then
            ./explodejs-docker.sh -xf $file -c config.json -e "${file}_explodejs"
        fi
    done
else
    Help
fi
