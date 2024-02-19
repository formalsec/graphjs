#!/bin/bash

# Check if node is installed
if which node > /dev/null; then
    echo "[INFO] Node is installed with version: $(node -v)."
else
    echo "[ERROR] Node is not installed. Please install node first."
    exit 1
fi

# Check if python3 is installed
if which python3 > /dev/null; then
    echo "[INFO] Python3 is installed."
else
    echo "[ERROR] Python3 is not installed. Please install python3 first."
    exit 1
fi


# Install npm dependencies
(cd parser && npm install)

# Python dependencies
pip3 install -r ./requirements.txt

