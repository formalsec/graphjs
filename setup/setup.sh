#!/bin/bash

# Constants.
THIS_SCRIPT=$(basename "$BASH_SOURCE")
THIS_SCRIPT_DIR=$(dirname "$0")

# Check and install python3 packages.
which python3 &> /dev/null 
if [ $? -neq 0 ]; then
    echo "[$THIS_SCRIPT][ERROR] - 'python3' must be available. Exiting."
    exit 1
else
    python3 -m pip install --user pip
    python3 -m pip install --user -U dill gspread colorama docker gspread psutil neo4j
fi

# Check and install 'nvm' if not available.
# See: https://github.com/nvm-sh/nvm
NVM_VERSION="v0.39.5"
which curl &> /dev/null 
if [ $? -eq 0 ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | bash
else 
    which wget &> /dev/null 
    if [ $? -eq 0 ]; then
        wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | bash
    else 
        echo "[$THIS_SCRIPT][ERROR] - need either 'curl' or 'wget' commands available. Exiting"
        exit 1
    fi  
fi

# Source .bashrc to make the command available.
source "$HOME/.bashrc"
nvm install v20.5.1


# Prepare explodejs npm packages.
cd "$THIS_SCRIPT_DIR/parser"
npm ci
echo "[$THIS_SCRIPT][INFO] - prepared explodejs 'parser' package"

cd "$THIS_SCRIPT_DIR/instrumentation"
npm ci
echo "[$THIS_SCRIPT][INFO] - prepared explodejs 'instrumentation' package"