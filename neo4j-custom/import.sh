#!/bin/bash

IMPORT_DIR="/var/lib/neo4j/import"

#neo4j-admin import --ignore-empty-strings=true --nodes="${IMPORT_DIR}/nodes.csv" --relationships="${IMPORT_DIR}/rels.csv"
neo4j-admin import --nodes="${IMPORT_DIR}/nodes.csv" --relationships="${IMPORT_DIR}/rels.csv" --delimiter='¿' --skip-bad-relationships=true --skip-duplicate-nodes=true