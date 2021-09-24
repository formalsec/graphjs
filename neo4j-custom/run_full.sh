#!/bin/bash

cp ../parser/graph_nodes.csv import-files/nodes.csv
cp ../parser/graph_rels.csv import-files/rels.csv
./run_neo4j.sh import-files/