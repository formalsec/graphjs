#!/bin/bash
shopt -s extglob

THIS_DIR=$(realpath "$0")
THIS_SCRIPT=$(basename $BASH_SOURCE) 

die() {
     echo $@ 1>&2   # print arguments of 'die' to standard error
     exit 1         # exit the script
}

Help()
{
    # Display Help
    echo "Usage: ./explodejs.sh [options] -f vulnerable_file.js -c config.json"
    echo "Description: Run Explode.js CPG construction, vulnerability detection and exploit generation."
    echo ""
    echo "Required:"
    echo "-f     Path to JavaScript file (.js) or directory containing JavaScript files for analysis."
    echo "-p     Docker container name."
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
EXPLODEJS_DIR=$(realpath "$(pwd)/explodejs")
CONTAINER_NAME="explodejs-neo4j-"$(tr -dc A-Za-z0-9 </dev/urandom | head -c 13 ; echo '')
GRAPH_DIR="$EXPLODEJS_DIR/graph"
NORM="$GRAPH_DIR/normalization.norm"
NORMALIZED="$EXPLODEJS_DIR/normalized.js"
TAINT_SUMMARY="$EXPLODEJS_DIR/taint_summary.json"
SYMBOLIC_TEST="$EXPLODEJS_DIR/symbolic_test.js"
NPM_CACHE_DIR="$EXPLODEJS_DIR/npm-cache-directory"
EXPLOIT=false
SILENT_OP=false
GRAPH_ONLY=false

# Function to find free ports for the Docker Neo4j image.
# See: https://stackoverflow.com/a/45539101
function get_free_port(){
    port=$1
    isfree=$(netstat -taln | grep $port)
    
    INCREMENT=$2
    
    while [[ -n "$isfree" ]]; do
        port=$[port+INCREMENT]
        isfree=$(netstat -taln | grep $port)
    done

    echo "$port"
}

# Find two free ports for the host-mapped HTTP and Bolt protocol ports.
# See: https://neo4j.com/docs/operations-manual/current/configuration/ports/
BASE_PORT=16998
INCREMENT=1
# NEO4J_HTTP_PORT=$(get_free_port $BASE_PORT $INCREMENT)
# NEO4J_BOLT_PORT=$(get_free_port $[$NEO4J_HTTP_PORT+1] $INCREMENT)

NEO4J_HTTP_PORT=7474
NEO4J_BOLT_PORT=7687


# process arguments
while getopts f:p:c:e:n:o:t:g:b:w:xsgh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        p) CONTAINER_NAME=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        e) EXPLODEJS_DIR=$OPTARG
            EXPLODEJS_DIR=$(realpath "$EXPLODEJS_DIR")
            GRAPH_DIR="$EXPLODEJS_DIR/graph"
            NORM="$GRAPH_DIR/normalization.norm"
            NORMALIZED="$EXPLODEJS_DIR/normalized.js"
            TAINT_SUMMARY="$EXPLODEJS_DIR/taint_summary.json"
            SYMBOLIC_TEST="$EXPLODEJS_DIR/symbolic_test.js";;
        n) NORMALIZED=$OPTARG;;
        o) TAINT_SUMMARY=$OPTARG;;
        t) SYMBOLIC_TEST=$OPTARG;;
        g) NORM=$OPTARG;;
        b) NEO4J_BOLT_PORT=$OPTARG;;
        w) NEO4J_HTTP_PORT=$OPTARG;;
        x) EXPLOIT=true;;
        s) SILENT_OP=true;;
        g) GRAPH_ONLY=true;;
        h) #display Help
            Help
            exit;;
    esac
done


# Check argument to single javascript source file
if [ -f "$CONFIGPATH" ] && [ -f "$FILEPATH" ]; then
    echo "Running Explode.js for $FILEPATH..."

    # Clean Explode.js output if it exists
    if [ -d "$EXPLODEJS_DIR" ] ; then
        rm -rf "$EXPLODEJS_DIR"/!(*expected_output.json)
    else
        mkdir -p "$EXPLODEJS_DIR" 
    fi

    # Create graph outputs dir
    mkdir -p "$GRAPH_DIR"

    # Default values
    FILEPATH=$(realpath "$FILEPATH")
    CONFIGPATH=$(realpath "$CONFIGPATH")

    # run cpg construction stage and serialize cpg
    # Passing arguments into npm.
    # See: https://stackoverflow.com/a/64694166
    # See: https://stackoverflow.com/a/51401577

    mkdir -p "$NPM_CACHE_DIR"

    export TS_NODE_CACHE_DIRECTORY="$NPM_CACHE_DIR"
    
    # "npm test", "npm start", "npm restart", and "npm stop" are all aliases for "npm run xxx".
    # See: https://stackoverflow.com/a/51358329

    if [ $SILENT_OP = true ]; then
        npm start --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv 
        #npm run start-custom-cache --prefix parser --explodejs_cache_dir="$NPM_CACHE_DIR" -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv
        #npm_config_explodejs_cache_dir="$NPM_CACHE_DIR" npm run start-custom-cache --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv
        #npm run start --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv --cache-directory "$NPM_CACHE_DIR"
    else
        npm start --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv 2>&1 | tee "$NORM"
        #npm run start-custom-cache --prefix parser --explodejs_cache_dir="$NPM_CACHE_DIR" -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv | tee "$NORM"
        #npm_config_explodejs_cache_dir="$NPM_CACHE_DIR" npm run start-custom-cache --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv | tee "$NORM"
        #npm run start --prefix parser -- -f "$FILEPATH" -c "$CONFIGPATH" -o "$NORMALIZED" -g "$GRAPH_DIR" --csv --cache-directory "$NPM_CACHE_DIR" | tee "$NORM"
    fi

    if [ $GRAPH_ONLY = false ]; then
        # get csv output to import dir in neo4j-custom dir
        NEO4J_DIR=$(realpath ./neo4j-custom)

        # import cpg to neo4j
        #NEO4J_EXPLODEJS_CONTAINER=neo4j-explodejs_$CONTAINER_NAME
        #NEO4J_EXPLODEJS_CONTAINER=$CONTAINER_NAME

        

        echo "[INFO][$THIS_SCRIPT] - Docker Neo4j using ports HTTP-$NEO4J_HTTP_PORT:7474 BOLT-$NEO4J_BOLT_PORT:7687"

        cd "$NEO4J_DIR"
        if [ $SILENT_OP = true ]; then
            $NEO4J_DIR/run_neo4j.sh "$GRAPH_DIR" $CONTAINER_NAME $NEO4J_HTTP_PORT $NEO4J_BOLT_PORT || die "[ERROR][$THIS_SCRIPT] caught error from $NEO4J_DIR/run_neo4j.sh, stopping."
        else
            $NEO4J_DIR/run_neo4j.sh "$GRAPH_DIR" $CONTAINER_NAME $NEO4J_HTTP_PORT $NEO4J_BOLT_PORT || die "[ERROR][$THIS_SCRIPT] caught error from $NEO4J_DIR/run_neo4j.sh, stopping."
        fi
        cd $(dirname "$THIS_DIR")

        # run all queries
        echo "[INFO][$THIS_SCRIPT] - Finished $NEO4J_DIR/run_neo4j.sh"
        echo "[INFO][$THIS_SCRIPT] - Running queries"
        QUERIES=$(realpath ./detection)
        python3 "$QUERIES/run.py" -f "$NORMALIZED" -o "$TAINT_SUMMARY" --bolt-port $NEO4J_BOLT_PORT

        # stop Neo4J container
        echo "[INFO][$THIS_SCRIPT] - Stopping and removing container $NEO4j_EXPLODEJS_CONTAINER"
        docker stop $CONTAINER_NAME

        # Create an exploit
        if $EXPLOIT; then
            echo "[INFO][$THIS_SCRIPT] - Creating exploit"
            
            # create symbolic tests
            echo "[INFO][$THIS_SCRIPT] - Creating symbolic tests"
            node instrumentation/src/instrumenter.js -i "$NORMALIZED" -c "$TAINT_SUMMARY" -o "$SYMBOLIC_TEST"
        fi
    fi
elif [ -f "$CONFIGPATH" ] && [ -d "$FILEPATH" ]; then
    for file in "$FILEPATH"/*; do
        if [[ ($file == *.js || $file == *.cjs) && -f $file ]] || [[ -d $string && $string != *explodejs ]]; then
            ./explodejs.sh -xf $file -c config.json -e "${file}_explodejs"
        fi
    done
else
    Help
fi
