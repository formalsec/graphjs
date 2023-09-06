#!/bin/bash

THIS_SCRIPT=$(basename "$BASH_SOURCE")

# Check if Docker service is running.
# See: https://stackoverflow.com/a/68836184/1708550
docker version > /dev/null 2>&1
docker_status=$?
if [ $docker_status -eq 0 ]; then
    echo "[INFO][$THIS_SCRIPT] - docker service is running."
else
    echo "[ERROR][$THIS_SCRIPT] - docker service is not running, exiting."
    exit 1
fi


CURR_DIR="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"  # cd current directory

# Not printing the output of 'pushd'.
pushd "$CURR_DIR" > /dev/null


IMAGE_NAME="neo4j-docker"

if [ "$#" -eq 1 ]
then
  IMAGE_NAME="$1"
fi

echo "[INFO][$THIS_SCRIPT] - Using docker image name $IMAGE_NAME."

# Check if the image exists locally.
# See: https://tecadmin.net/check-if-a-docker-image-exists-locally/
if docker image inspect $IMAGE_NAME >/dev/null 2>&1; then
    echo "[INFO][$THIS_SCRIPT] - Docker image $IMAGE_NAME exists, not building."
else
    echo "[INFO][$THIS_SCRIPT] - Building Docker image $IMAGE_NAME."
    if [[ "$OSTYPE" =~ ^darwin ]]; then
      docker build --platform linux/amd64 . -t neo4j-docker
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      docker build --platform linux/x86_64 -q . -t neo4j-docker
    else
      docker build . -t neo4j-docker
    fi
    echo "[INFO][$THIS_SCRIPT] - Docker image $IMAGE_NAME finished building."
fi

popd > /dev/null