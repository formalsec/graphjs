#!/bin/bash

# Constants.
THIS_SCRIPT=$(basename "$BASH_SOURCE")
THIS_SCRIPT_DIR=$(dirname "$0")

# Check and install python3 packages.
printf "\n#####\n"
printf "##### Checking python3 and its packages.\n"
printf "#####\n\n"

which python3 &> /dev/null 

if [ $? -ne 0 ]; then
    echo "[$THIS_SCRIPT][ERROR] - 'python3' must be available. Exiting."
    exit 1
else
    printf "[$THIS_SCRIPT][INFO] - 'python3' found, trying to install necessary packages.\n"
    python3 -m pip install --user -U pip
    python3 -m pip install --user -U dill gspread colorama docker gspread psutil neo4j google-auth
fi


# Check and install 'nvm' if not available.
# See: https://github.com/nvm-sh/nvm
printf "\n#####\n"
printf "##### Checking nvm, node and npm.\n"
printf "#####\n\n"

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
NODE_VERSION="v20.5.1"
source "$HOME/.bashrc"

#echo $NVM_DIR
export NVM_DIR=$HOME/.nvm;
source $NVM_DIR/nvm.sh;

nvm install $NODE_VERSION

printf "\n#####\n"
printf "##### Compile explodejs.sh files.\n"
printf "#####\n\n"

# Prepare explodejs npm packages.
printf "\n##### Configuring explodejs parser... \n"
cd "$THIS_SCRIPT_DIR/../parser"
npm ci
echo "[$THIS_SCRIPT][INFO] - prepared explodejs 'parser' package"

printf "\n##### Configuring explodejs instrumentation... \n"
cd "$THIS_SCRIPT_DIR/../instrumentation"
npm ci
echo "[$THIS_SCRIPT][INFO] - prepared explodejs 'instrumentation' package"