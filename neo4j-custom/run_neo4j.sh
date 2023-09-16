#!/bin/bash
DEBUG=false

THIS_SCRIPT=$(basename "$BASH_SOURCE")

echo "[INFO][$THIS_SCRIPT] - DEBUG = $DEBUG"

if [[ -z $1 ]]; then
    echo "$0: Required path containing graph files"
    exit 4
fi

GRAPH_DIR_PATH=$(realpath "$1")
GRAPH_DIR_BASE=$(basename "$GRAPH_DIR_PATH")
PARENT_DIR=$(dirname "$GRAPH_DIR_PATH")
echo "[INFO][$THIS_SCRIPT] - Reading $GRAPH_DIR_BASE"

# Check if is zip file
ZIP_FILE=false
if [[ $GRAPH_DIR_BASE =~ \.zip$ ]]; then
    ZIP_FILE=true
    GRAPH_DIR_BASE=$(echo $GRAPH_DIR_BASE | cut -d '.' -f1)
    unzip "$GRAPH_DIR_PATH" -d "$PARENT_DIR/$GRAPH_DIR_BASE"
    GRAPH_DIR_PATH="$PARENT_DIR/$GRAPH_DIR_BASE"
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

#RESULTS_DIR="execution-results"

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

# Build neo4j Docker image.
BUILD_IMAGE=false

if [ "$BUILD_IMAGE" = "true" ]
then
    echo "[INFO][$THIS_SCRIPT] - Building image for container $NEO4J_EXPLODEJS_CONTAINER"
    if [[ "$OSTYPE" =~ ^darwin ]]; then
      docker build --platform linux/amd64 . -t neo4j-docker
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      docker build --platform linux/x86_64 -q . -t neo4j-docker
    else
      docker build . -t neo4j-docker
    fi
else
    echo "[INFO][$THIS_SCRIPT] - not building image via the current script."
fi


echo "[INFO][$THIS_SCRIPT] - Running container $NEO4J_EXPLODEJS_CONTAINER - HTTP-$NEO4J_HTTP_PORT:7474 BOLT-$NEO4J_BOLT_PORT:7687"


# Activate debugging from here.
# https://tldp.org/LDP/Bash-Beginners-Guide/html/sect_02_03.html
# set -x		

echo "[INFO][$THIS_SCRIPT] - Calling 'docker run' with --detach=$DEBUG"

# Creating a special directory for the Docker logs.
DOCKER_LOGS_PATH="$GRAPH_DIR_PATH/../docker-logs"
mkdir -p "$DOCKER_LOGS_PATH"

if [ "$DEBUG" = true ]; then
    # Run container
    
    docker run --rm --name $NEO4J_EXPLODEJS_CONTAINER -v "$GRAPH_DIR_PATH":/var/lib/neo4j/import \
        --user $(id -u):$(id -g) \
        -e NEO4J_dbms_query__cache__size=0 \
        -v "$DOCKER_LOGS_PATH":/var/lib/neo4j/logs \
        -p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker
        #-e NEO4J_apoc_export_file_enabled=true \
        #-e NEO4J_apoc_import_file_enabled=true \
        #-e NEO4J_apoc_import_file_use__neo4j__config=true \
        #-p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker
    #sleep 5

    docker_status=$?
    if [ $docker_status -eq 0 ]; then
        echo "[INFO][$THIS_SCRIPT] - docker run succeeded or closed due to Ctrl+C in test.py (--detach=$DEBUG)"
    else
        echo "[ERROR][$THIS_SCRIPT] - docker run exited early (either timeout expired or it crashed)"
    fi
    exit $docker_status
else
    

    docker run -d --rm --name $NEO4J_EXPLODEJS_CONTAINER -v "$GRAPH_DIR_PATH":/var/lib/neo4j/import \
        --user $(id -u):$(id -g) \
        -e NEO4J_dbms_query__cache__size=0 \
        -v "$DOCKER_LOGS_PATH":/var/lib/neo4j/logs \
        -p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker
        #-e NEO4J_apoc_export_file_enabled=true \
        #-e NEO4J_apoc_import_file_enabled=true \
        #-e NEO4J_apoc_import_file_use__neo4j__config=true \
        #-p $NEO4J_HTTP_PORT:7474 -p $NEO4J_BOLT_PORT:7687 neo4j-docker

    docker_status=$?
    if [ $docker_status -eq 0 ]; then
        echo "[INFO][$THIS_SCRIPT] - docker run command succeeded (--detach=$DEBUG)"
    else
        echo "[ERROR][$THIS_SCRIPT] - docker run exited early (either timeout expired or it crashed)."
        echo "[ERROR][$THIS_SCRIPT] - exit code: $docker_status"
        exit $docker_status
    fi
    
    counter=0


    # Wait for neo4j to start inside the container
    sleep 5
    #until docker logs --tail 1 $NEO4J_EXPLODEJS_CONTAINER | grep -q "Started."; do
    until [[ $counter -eq 25 ]]
    do

      # Catching exit status based on: https://unix.stackexchange.com/a/373598
      echo "[INFO][$THIS_SCRIPT] - Checking if neo4j has printed 'Started' in 'docker run' (--detach=$DEBUG) container launch."
      docker_check=$(docker logs --tail 1 $NEO4J_EXPLODEJS_CONTAINER 2>&1)
      docker_check_exit_code=$?
      if [ $docker_check_exit_code -eq 0 ]; then
        
        # Checking for a substring inside a string.
        # See: https://linuxize.com/post/how-to-check-if-string-contains-substring-in-bash/
        if [[ "$docker_check" == *"Started"* ]]; then
          echo "[INFO][$THIS_SCRIPT] - Saw Docker container running $NEO4J_EXPLODEJS_CONTAINER. (--detach=$DEBUG)"
          exit 0
        fi

      else
          echo "[ERROR][$THIS_SCRIPT] - docker run did not behave as expected."
          echo "[ERROR][$THIS_SCRIPT] - exit code: $docker_check_exit_code"
          echo "[ERROR][$THIS_SCRIPT] - 'docker logs --tail 1 $NEO4J_EXPLODEJS_CONTAINER 2>&1' output:"
          printf "\t$docker_check\n"
          exit $docker_check_exit_code
      fi
      
      #grep -q "Started."

    
      sleep 3
      
      counter=$((counter+1))

      #$((counter++))

      #if [[ $counter -eq 25 ]]; then
      #  exit 1
      #fi
    done
    exit 0
fi

# Disable bash debugging.
# set +x

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
