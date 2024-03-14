#!/bin/bash

IMPORT_DIR="/var/lib/neo4j/import"
RUN_DIR="/var/lib/neo4j/runs"

neo4j-admin database import full --overwrite-destination --nodes="${IMPORT_DIR}/nodes.csv" --relationships="${IMPORT_DIR}/rels.csv" --delimiter=U+00BF --skip-bad-relationships=true --skip-duplicate-nodes=true &> "${RUN_DIR}/neo4j_import.txt"
