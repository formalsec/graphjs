import os

# Neo4j Config
NEO4J_USER = 'neo4j'
NEO4J_PASSWORD = 'neo4jroot'
NEO4J_CONTAINER = 'neo4j-graphjs'

# Paths
BASE_DIR = os.path.dirname(os.path.realpath(__file__))
MDG_PATH = f'{BASE_DIR}/parser/built/src/parser.js'
PARSER_PATH = f'{BASE_DIR}/parser'
CONFIG_FILE = f'{BASE_DIR}/config.json'
DEFAULT_RESULTS_PATH = f'{BASE_DIR}/graphjs-results'
