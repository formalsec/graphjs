#!/bin/bash

# Get current and parent dir
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PARENT_DIR=$(dirname "${SCRIPT_DIR}")


# Display help
Help()
{
    echo "Usage: ./graphjs_docker.sh -i <path> [options]"
    echo "Description: Run Graph.js for a given input path <path> in a Docker container."
    echo ""
    echo "Required:"
    echo "-i <path>    Input path (filename to run specific file or directory to run package level)."
    echo ""
    echo "Options:"
    echo "-o <path>    Path to store analysis results."
    echo "-e           Create exploit template."
    echo "-s           Silent mode: Does not save graph .svg."
    echo "-h           Print this help."
    echo
}


# Default values
SILENT_MODE=false
EXTENDED_SUMMARY=false
FLAGS=""
while getopts i:o:esh flag; do
    case "${flag}" in
        i) input_path=$OPTARG
            input_path="$( realpath "$input_path" )"
            if [ ! -f "$input_path" ] && [ ! -d "$input_path" ]; then
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

# Check if the required input path is provided
if [ ! -f "$input_path" ] && [ ! -d "$input_path" ]; then
  echo "Option -i is required."
  Help
  exit 1
fi

# If output_path is not provided, use default
if [ ! -d "$output_path" ]; then
    # Generate output file
    # If path is a directory, go up one level only
    if [ -d "$input_path" ]; then
        file_parent_dir=$(dirname "$input_path")
    else
        file_parent_dir=$(dirname "$(dirname "$input_path")")        
    fi
    output_path="$file_parent_dir/tool_outputs/graphjs"
    mkdir -p ${output_path}
fi

echo $output_path
input_dir=$(dirname "$input_path")
fname=$(basename "$input_path")

# Build docker image if it does not exist
if [ -z "$(docker images -q graphjs)" ]; then
    docker build . -t graphjs
fi

docker run -it \
    -v "${input_dir}":/input \
    -v "${output_path}":/output_path \
    graphjs \
    /bin/bash -c "sudo chown graphjs:graphjs -R /output_path; python3 graphjs -f /input/$fname -o /output_path ${FLAGS}"
#docker system prune -f
