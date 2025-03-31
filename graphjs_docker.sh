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
    echo "-f <path>    Filename (.js) / Package path."
    echo ""
    echo "Options:"
§§    echo "-o <path>    Path to store analysis results."
    echo "-e           Create exploit template."
    echo "-s           Silent mode: Does not save graph .svg."
    echo "-h           Print this help."
    echo
}


# Default values
SILENT_MODE=false
EXTENDED_SUMMARY=false
FLAGS=""
while getopts f:o:esh flag; do
    case "${flag}" in
        f) filename=$OPTARG
            filename="$( realpath "$filename" )"
            if [ ! -f "$filename" ] && [ ! -d "$filename" ]; then
                echo "File $OPTARG does not exist."
                exit 1
            fi;;
        o) output_path=$OPTARG
            output_path="$( realpath "$output_path" )"
            if [ ! -d "$output_path" ]; then
                echo "Output path $OPTARG does not exist."
                exit 1
            fi;;
        e) FLAGS+=" -e";;
        s) FLAGS+=" -s";;
        :?h) Help
        exit;;
    esac
done

# Check if the required filename is provided
if [ ! -f "$filename" ] && [ ! -d "$filename" ]; then
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

input_dir=$(dirname "$filename")
fname=$(basename "$filename")

# Build docker image if it does not exist
if [ -z "$(docker images -q graphjs)" ]; then
    docker build . -t graphjs
fi

docker run -it \
    -v "$input_dir":/input \
    -v "${output_path}":/output_path \
    graphjs \
    /bin/bash -c "python3 /graphjs/graphjs -f /input/$fname -o /output_path ${FLAGS}"
docker system prune -f