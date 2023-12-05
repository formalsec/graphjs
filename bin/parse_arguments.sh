#!/bin/bash

# Display help
Help()
{
    echo "Usage: ./graphjs.sh [options] -f vulnerable_file.js"
    echo "Description: Run Graph.js graph generator and vulnerability detection."
    echo ""
    echo "Required:"
    echo "-f     Path to JavaScript file (.js) or directory containing JavaScript files for analysis."
    echo ""
    echo "Options:"
    echo "-c     Path to JSON file (.json) containing the unsafe sinks."
    echo "-e     Path to store Graph.js output files."
    echo "-o     Path to Graph.js taint summary file (.json)."
    echo "-t     Path to Graph.js symbolic test (.js)."
    echo "-n     Path to normalization output file."
    echo "-x     Create an exploit."
    echo "-g     Generate only the CPG."
    echo "-s     Silent mode - no console output."
    echo "-h     Print this Help."
    echo
}

# Default values
GRAPHJS_DIR="${ROOT_DIR}/graphjs-results"
CONFIGPATH="${ROOT_DIR}/config.json"
GRAPH_DIR="$GRAPHJS_DIR/graph"
NORM="$GRAPH_DIR/normalization.norm"
NORMALIZED="$GRAPHJS_DIR/normalized.js"
TAINT_SUMMARY="$GRAPHJS_DIR/taint_summary.json"
SYMBOLIC_TEST="$GRAPHJS_DIR/symbolic_test.js"
PERFORMANCE_FILE="$GRAPHJS_DIR/time_stats.txt"
EXPLOIT=false
SILENT_OP=false
GRAPH_ONLY=false

# Process arguments
while getopts f:c:e:n:o:t:g:xsgh flag
do
    case "${flag}" in
        f) FILEPATH=$OPTARG;;
        c) CONFIGPATH=$OPTARG;;
        e) GRAPHJS_DIR=$OPTARG
            mkdir -p $GRAPHJS_DIR && GRAPHJS_DIR="$(realpath $GRAPHJS_DIR)"
            GRAPH_DIR="$GRAPHJS_DIR/graph"
            NORM="$GRAPH_DIR/normalization.norm"
            NORMALIZED="$GRAPHJS_DIR/normalized.js"
            PERFORMANCE_FILE="$GRAPHJS_DIR/time_stats.txt"
            TAINT_SUMMARY="$GRAPHJS_DIR/taint_summary.json"
            SYMBOLIC_TEST="$GRAPHJS_DIR/symbolic_test.js";;
        n) NORMALIZED=$OPTARG;;
        o) TAINT_SUMMARY=$OPTARG;;
        t) SYMBOLIC_TEST=$OPTARG;;
        g) NORM=$OPTARG;;
        x) EXPLOIT=true;;
        s) SILENT_OP=true;;
        g) GRAPH_ONLY=true;;
        h) #display Help
            Help
            exit;;
    esac
done
