#!/bin/bash

docker stop neo4j-explodejs
cp ../parser/src/graphs/graph_nodes.csv import-files/nodes.csv
cp ../parser/src/graphs/graph_rels.csv import-files/rels.csv
./run_neo4j.sh import-files/