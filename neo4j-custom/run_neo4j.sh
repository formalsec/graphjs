#!/bin/bash
DEBUG=false

if [[ -z $1 ]]; then
    echo "$0: Required path containing graph files"
    exit 4
fi

GRAPH_DIR_PATH=$(realpath $1)
GRAPH_DIR_BASE=$(basename "$GRAPH_DIR_PATH")
PARENT_DIR=$(dirname "$GRAPH_DIR_PATH")
echo "[INFO] - Reading $GRAPH_DIR_BASE"

# Check if is zip file
ZIP_FILE=false
if [[ $GRAPH_DIR_BASE =~ \.zip$ ]]; then
    ZIP_FILE=true
    GRAPH_DIR_BASE=$(echo $GRAPH_DIR_BASE | cut -d '.' -f1)
    unzip $GRAPH_DIR_PATH -d $PARENT_DIR/$GRAPH_DIR_BASE
    GRAPH_DIR_PATH=$PARENT_DIR/$GRAPH_DIR_BASE
fi

# TODO: Need to check if there is a second argument if run_neo4j.sh is called from other places
#NEO4J_EXPLODEJS_CONTAINER=neo4j-explodejs
NEO4J_EXPLODEJS_CONTAINER=$2
NEO4J_HTTP_PORT=$3
NEO4J_BOLT_PORT=$4

if [ -z "$2" ]
  then
    NEO4J_EXPLODEJS_CONTAINER="neo4j-explodejs"
fi

if [ -z "$3" ]
  then
    NEO4J_HTTP_PORT="7474"
fi

if [ -z "$4" ]
  then
    NEO4J_BOLT_PORT="7687"
fi

RESULTS_DIR=execution-results

# # Function to find free ports for the Docker Neo4j image.
# # See: https://stackoverflow.com/a/45539101
# function get_free_port(){
#   port=$1
#   isfree=$(netstat -taln | grep $port)
  
#   INCREMENT=$2
  
#   while [[ -n "$isfree" ]]; do
#     port=$[port+INCREMENT]
#     isfree=$(netstat -taln | grep $port)
#   done

#   echo "$port"
# }

# # Find two free ports for the host-mapped HTTP and Bolt protocol ports.
# # See: https://neo4j.com/docs/operations-manual/current/configuration/ports/
# BASE_PORT=16998
# INCREMENT=1
# NEO4J_HTTP_PORT=$(get_free_port $BASE_PORT $INCREMENT)
# NEO4J_BOLT_PORT=$(get_free_port $[$NEO4J_HTTP_PORT+1] $INCREMENT)

# On 'docker run -p HOST_PORT:CONTAINER_INNER_PORT' mapping:
# https://www.baeldung.com/linux/assign-port-docker-container

# Build container
echo "[INFO] - Building image for container $NEO4J_EXPLODEJS_CONTAINER"
if [[ "$OSTYPE" =~ ^darwin ]]; then
  docker build --platform linux/amd64 . -t neo4j-docker
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  docker build --platform linux/x86_64 -q . -t neo4j-docker
else
  docker build . -t neo4j-docker
fi

echo "[INFO] - Running container $NEO4J_EXPLODEJS_CONTAINER"
echo "[INFO] - Running HTTP-$NEO4J_HTTP_PORT:7474 BOLT-$NEO4J_BOLT_PORT:7687"
if [ "$DEBUG" = true ]; then
    # Run container
    docker run --rm --name $NEO4J_EXPLODEJS_CONTAINER -v $GRAPH_DIR_PATH:/var/lib/neo4j/import \
        --user $(id -u):$(id -g) \
        -e NEO4J_dbms_query__cache__size=0 \
        -e NEO4J_apoc_export_file_enabled=true \
        -e NEO4J_apoc_import_file_enabled=true \
        -e NEO4J_apoc_import_file_use__neo4j__config=true \
        -p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker
else
    docker run -d --rm --name $NEO4J_EXPLODEJS_CONTAINER -v $GRAPH_DIR_PATH:/var/lib/neo4j/import \
        --user $(id -u):$(id -g) \
        -e NEO4J_dbms_query__cache__size=0 \
        -e NEO4J_apoc_export_file_enabled=true \
        -e NEO4J_apoc_import_file_enabled=true \
        -e NEO4J_apoc_import_file_use__neo4j__config=true \
        -p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker
    # Wait for neo4j to start inside the container
    until docker logs --tail 1 $NEO4J_EXPLODEJS_CONTAINER | grep -q "Started."; do
      :
    done
fi

# if [ "$DEBUG" = false ]; then
# # Move results and times to execution results directory
# mkdir -p $RESULTS_DIR/$GRAPH_DIR_BASE/
# mv $GRAPH_DIR_PATH/*.txt $RESULTS_DIR/$GRAPH_DIR_BASE/
# mv $GRAPH_DIR_PATH/*_result.csv $RESULTS_DIR/$GRAPH_DIR_BASE/
# fi

# # Remove dir if was zip
# if [ "$ZIP_FILE" = true ]; then
#     rm -r $GRAPH_DIR_PATH
# fi
