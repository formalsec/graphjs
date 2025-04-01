#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." &> /dev/null && pwd)"
# Check if PROJECT_DIR is set
if [ -z "$PROJECT_DIR" ]; then
    echo "PROJECT_DIR is not set. Please set it to the root directory of the project."
    exit 1
fi

# Display help
Help()
{
    echo "Usage: ./run_graphjs.sh -d <dataset> -v <vulnerability_type>"
    echo "Description: Run Graph.js vulnerability detection."
    echo ""
    echo "Required:"
    echo "-d     Dataset Name (vulcan/secbench/collected/test)."
    echo ""
    echo "Options:"
    echo "-l     Dataset Location (directory where the dataset is stored). Default is <PROJECT_DIR>/explodejs-datasets".
    echo "-v     Type of vulnerability (path-traversal/command-execution/code-injection/prototype-pollution)."
    echo "-p     Only run package level."
    echo "-h     Print this Help."
}

# Default values
VULN_TYPE=all # Run for all types)
EXTENDED_SUMMARY=false
DATASET_LOCATION=$(dirname "${PROJECT_DIR}")/explodejs-datasets
FLAGS=""
while getopts d:l:v:peh flag; do
    case "${flag}" in
        d) DATASET=$OPTARG
           if [[ "$DATASET" != "vulcan" && "$DATASET" != "secbench" && "$DATASET" != "collected" && "$DATASET" != "test" && "$DATASET" != "zeroday" ]]; then
               echo "Dataset name must be 'vulcan', 'secbench', 'collected', 'test', or 'zeroday'. You provided $DATASET. Exiting."
               exit 1
           fi
           ;;
        l) DATASET_LOCATION=$OPTARG
           if [ ! -d "$DATASET_LOCATION" ]; then
               echo "Dataset location $DATASET_LOCATION does not exist."
               exit 1
           fi
           ;;
         v) VULN_TYPE=$OPTARG
            if [[ "$VULN_TYPE" != "path-traversal" && "$VULN_TYPE" != "command-execution"
                  && "$VULN_TYPE" != "code-injection" && "$VULN_TYPE" != "prototype-pollution" ]]; then
                echo "Vulnerability type must be 'path-traversal', 'command-execution', 'code-injection',
                  or 'prototype-pollution'. You provided $VULN_TYPE. Exiting."
                exit 1
            fi
            ;;
        e) FLAGS="$FLAGS -e";;
        p) FLAGS="$FLAGS -p";;
        :?h) Help
           exit;;
    esac
done

# Check if the required argument is provided
if [ -z "$DATASET" ]; then
  echo "Option -d is required."
  Help
  exit 1
fi

docker run -it \
        -v $DATASET_LOCATION:/home/graphjs/datasets \
        graphjs \
        /bin/bash -c "python3 tests/datasets/graphjs_dataset.py -d "$DATASET" -v "$VULN_TYPE" ${FLAGS}"
#docker system prune -f