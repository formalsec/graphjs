#!/bin/bash

IMPORT_DIR="/var/lib/neo4j/import"

neo4j-admin database import full --overwrite-destination --nodes="${IMPORT_DIR}/nodes.csv" --relationships="${IMPORT_DIR}/rels.csv" --delimiter=U+00BF --skip-bad-relationships=true --skip-duplicate-nodes=true
