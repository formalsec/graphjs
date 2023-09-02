#!/bin/bash

THIS_SCRIPT=$(basename "$BASH_SOURCE")

CURR_DIR="$(cd -P -- "$(dirname -- "$0")" && pwd -P)"

pushd "$CURR_DIR"

IMAGE_NAME="neo4j-docker"
if docker image inspect $IMAGE_NAME >/dev/null 2>&1; then
    echo "[INFO][$THIS_SCRIPT] - Docker image $IMAGE_NAME exists, not building."
else
    echo "[INFO][$THIS_SCRIPT] - Building image for container $NEO4J_EXPLODEJS_CONTAINER"
    if [[ "$OSTYPE" =~ ^darwin ]]; then
      docker build --platform linux/amd64 . -t neo4j-docker
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      docker build --platform linux/x86_64 -q . -t neo4j-docker
    else
      docker build . -t neo4j-docker
    fi
fi

popd