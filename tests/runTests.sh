#!/bin/zsh

INPUT_DIR="input"
SINGLE_FILE_TESTS="${INPUT_DIR}/single_file"
MULTI_FILE_TESTS="${INPUT_DIR}/multifile"
OUTPUT_DIR="output"
EXPECTED_DIR="expected"
BLUE='\033[0;34m'
NC='\033[0m' # No Color
RED='\033[0;31m'
GREEN='\033[0;32m'


# If output dir exists, remove it
if [ -d "output" ]; then
    rm -r output
fi

# Create output dir
mkdir output
mkdir graphjs-results

source ../../env/bin/activate # activate virtual environment

# Check if docker is running
if ! docker info &> /dev/null; then
    echo "Docker is not running. Please start docker and try again."
    exit 1
fi

# Run single file tests
for file in ${SINGLE_FILE_TESTS}/*; do
    echo "${BLUE}[INFO] Running test: ${file}${NC}"
    ../graphjs_docker.sh -f ${file} -o graphjs-results -s > /dev/null
    cp graphjs-results/taint_summary.json ${OUTPUT_DIR}/single_file_${file:t:r}_taint_summary.json
done

# Run multi file tests
for file in ${MULTI_FILE_TESTS}/*; do
    echo "${BLUE}[INFO] Running test: ${file}${NC}"
    ../graphjs_docker.sh -f ${file}/main.js -o graphjs-results -s > /dev/null
    cp ../graphjs-results/taint_summary.json ${OUTPUT_DIR}/multifile_${file:t:r}_taint_summary.json
done


diff -rq ${OUTPUT_DIR} ${EXPECTED_DIR} > diff.output

 if [ $? -eq 0 ]; then
    echo "${Green}All tests passed"
    rm -rf diff.output output
else
    echo "${RED}Tests failed${NC}"
    cat diff.output
    echo "Manually remove the output directory"
fi



deactivate # deactivate virtual environment