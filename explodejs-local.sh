#!/bin/bash

# Variables for performance evaluation
START_TIMER=0
END_TIMER=0

# Evaluation functions
start_timer () {
  START_TIMER=$(gdate +%s%N)
}
stop_timer () {
  END_TIMER=$(gdate +%s%N)
  ELAPSED_TIMES=$(($((END_TIMER-START_TIMER))/1000000))
  echo "\"$1\": ${ELAPSED_TIMES}, " >> "$PERFORMANCE_FILE"
}

mark_query_timer () {
  END_TIMER=$(tail -n 1 "query_time.txt" | awk -F '.' '{print $1}')
  ELAPSED_TIMES=$(($((END_TIMER-(START_TIMER/1000000)))))
  echo "\"query\": $ELAPSED_TIMES, " >> "$PERFORMANCE_FILE"
}

mark_import_timer () {
  ELAPSED_TIMES=$(cat "neo4j_import.txt" | grep "IMPORT DONE" | awk -F 'in ' '{print $2}' | awk -F'ms' '{print $1}')
  SECONDS=$(echo $ELAPSED_TIMES | awk -F's ' '{print $1}')
  MSECONDS=$(echo $ELAPSED_TIMES | awk -F's ' '{print $2}')
  if [[ -z $MSECONDS ]]
  then
    ELAPSED_TIMES=${SECONDS}
  else
    ELAPSED_TIMES=$(($((MSECONDS+(SECONDS*1000)))))
  fi
  echo "\"import\": $ELAPSED_TIMES, " >> "$PERFORMANCE_FILE"
}

setup_performance_file() {
  echo "{" > "$PERFORMANCE_FILE"
}

shopt -s extglob

THIS_DIR=$(realpath "$0")
NEO4J_CMD=/opt/homebrew/Cellar/neo4j/5.9.0/bin/neo4j
NEO4J_ADMIN_CMD=/opt/homebrew/Cellar/neo4j/5.9.0/bin/neo4j-admin

Help()
{
    # Display Help
    echo "Usage: ./explodejs.sh [options] -f vulnerable_file.js -c config.json"
    echo "Description: Run Explode.js CPG construction, vulnerability detection and exploit generation."
    echo ""
    echo "Required:"
    echo "-f     Path to JavaScript file (.js) or directory containing JavaScript files for analysis."
    echo "-c     Path to JSON file (.json) containing the unsafe sinks."
    echo ""
    echo "Options:"
    echo "-e     Path to store Explode.js output files."
    echo "-o     Path to Explode.js taint summary file (.json)."
    echo "-t     Path to Explode.js symbolic test (.js)."
    echo "-n     Path to normalization output file."
    echo "-x     Create an exploit."
    echo "-g     Generate only the CPG."
    echo "-s     Silent mode - no console output."
    echo "-h     Print this Help."
    echo
}

# Default values
EXPLODEJS_DIR="$(pwd)/explodejs"
GRAPH_DIR="$EXPLODEJS_DIR/graph"
NORM="$GRAPH_DIR/normalization.norm"
NORMALIZED="$EXPLODEJS_DIR/normalized.js"
TAINT_SUMMARY="$EXPLODEJS_DIR/taint_summary.json"
SYMBOLIC_TEST="$EXPLODEJS_DIR/symbolic_test.js"
PERFORMANCE_FILE="$EXPLODEJS_DIR/time_stats.json"
EXPLOIT=false
SILENT_OP=true
GRAPH_ONLY=false

# process arguments
while getopts f:c:e:n:o:t:g:xsgh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        e) EXPLODEJS_DIR=$OPTARG
            EXPLODEJS_DIR="$(pwd)/$EXPLODEJS_DIR"
            GRAPH_DIR="$EXPLODEJS_DIR/graph"
            NORM="$GRAPH_DIR/normalization.norm"
            NORMALIZED="$EXPLODEJS_DIR/normalized.js"
            PERFORMANCE_FILE="$EXPLODEJS_DIR/time_stats.json"
            TAINT_SUMMARY="$EXPLODEJS_DIR/taint_summary.json"
            SYMBOLIC_TEST="$EXPLODEJS_DIR/symbolic_test.js";;
        n) NORMALIZED=$OPTARG;;
        o) TAINT_SUMMARY=$OPTARG;;
        t) SYMBOLIC_TEST=$OPTARG;;
        g) NORM=$OPTARG;;
        x) EXPLOIT=true;;
        s) SILENT_OP=true;;
        g) GRAPH_ONLY=true;;
        h) #display Help
            Help
            exit;;
    esac
done

# check argument to single javascript source file
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

    setup_performance_file
    # run cpg construction stage and serialize cpg
    start_timer
    if [ $SILENT_OP = true ]; then
        npm start --prefix parser -- -s -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv --silent
    else
        npm start --prefix parser -- -f $FILEPATH -c $CONFIGPATH -o $NORMALIZED -g $GRAPH_DIR --csv 2>&1 | tee $NORM
    fi
    stop_timer "graph"


    if [ $GRAPH_ONLY = false ]; then
        # get csv output to import dir in neo4j-custom dir
        NEO4J_DIR=$(realpath ./neo4j-custom)

        # import cpg to neo4j
        cd $NEO4J_DIR
        $NEO4J_CMD stop

        start_timer
        $NEO4J_ADMIN_CMD database import full --overwrite-destination --nodes="$GRAPH_DIR/nodes.csv" --relationships="$GRAPH_DIR/rels.csv" --delimiter='¿' --skip-bad-relationships=true --skip-duplicate-nodes=true --high-parallel-io=on > neo4j_import.txt
        mark_import_timer

        start_timer # Start timer for start timer
        $NEO4J_CMD console > neo4j_start.txt &
        until (cat neo4j_start.txt | grep "Started"); do sleep 0.5; done;
        stop_timer "start"

        cd $(dirname $THIS_DIR)

        # run all queries
        echo "[INFO] - Running queries for $FILEPATH"
        start_timer # Start timer for query timer
        QUERIES=$(realpath ./detection)
        python3 $QUERIES/run.py -f $FILEPATH -o $TAINT_SUMMARY > query_time.txt
        mark_query_timer

        #python3 $QUERIES/import.py
        #cp $GRAPH_DIR/nodes.csv /opt/homebrew/var/neo4j/import/
        #cp $GRAPH_DIR/rels.csv /opt/homebrew/var/neo4j/import/

        # Create an exploit
        if $EXPLOIT; then
            echo "[INFO] - Creating exploit"
            
            # create symbolic tests
            echo "[INFO] - Creating symbolic tests"
            node instrumentation/src/instrumenter.js -i $NORMALIZED -c $TAINT_SUMMARY -o $SYMBOLIC_TEST
        fi
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
