#!/bin/bash

# Get current and parent dir
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PARENT_DIR=$(dirname "${SCRIPT_DIR}")


# Display help
Help()
{
    echo "Usage: ./graphjs_docker.sh -f <file> [options]"
    echo "Description: Run Graph.js for a given file <file> in a Docker container."
    echo ""
    echo "Required:"
    echo "-f <file>    Filename (.js)."
    echo ""
    echo "Options:"
    echo "-o <path>    Path to store analysis results."
    echo "-l           Store docker logs."
    echo "-e           Create exploit template."
    echo "-s           Silent mode: Does not save graph .svg."
    echo "-h           Print this help."
    echo
}


# Default values
SILENT_MODE=false
EXPLOIT=false
DOCKER_LOGS=false
while getopts f:o:les:h flag; do
    case "${flag}" in
        f) filename=$OPTARG
            filename="$( realpath "$filename" )"
            if [ ! -f "$filename" ]; then
                echo "File $OPTARG does not exist."
                exit 1
            fi;;
        o) output_path=$OPTARG
            output_path="$( realpath "$output_path" )"
            if [ ! -d "$output_path" ]; then
                echo "Output path $OPTARG does not exist."
                exit 1
            fi;;
        l) DOCKER_LOGS=true;;
        e) EXPLOIT=true;;
        s) SILENT=true;;
        :?h) Help
        exit;;
    esac
done

# Check if the required filename is provided
if [ ! -f "$filename" ]; then
  echo "Option -f is required."
  Help
  exit 1
fi

# If output_path is not provided, use default
if [ ! -d "$output_path" ]; then
  # Generate output file
  file_parent_dir=$(dirname "$(dirname "$filename")")
  output_path="$file_parent_dir/tool_outputs/graphjs"
fi


# Build docker image if it does not exist
if [ -z "$(docker images -q graphjs)" ]; then
    docker build . -t graphjs
fi

if [ "$DOCKER_LOGS" = true ]; then
    mkdir -p ${SCRIPT_DIR}/docker_logs
    docker run -it \
        -v "${filename}":/input-file.js \
        -v "${output_path}":/output_path \
        -v "${SCRIPT_DIR}/docker_logs":/docker_logs \
        graphjs \
        /bin/bash -c "python3 /graphjs/graphjs.py -f /input-file.js -o /output_path -s &> /docker_logs/graphjs-debug.log;
                      cp /var/log/neo4j/debug.log /docker_logs/neo4j-debug.log"
    mv docker_logs ${output_path}/
else
    docker run -it \
        -v "${filename}":/input-file.js \
        -v "${output_path}":/output_path \
        graphjs \
        python3 /graphjs/graphjs.py -f /input-file.js -o /output_path -s
fi

