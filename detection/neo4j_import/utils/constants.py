import os

# Neo4j Config
NEO4J_USER = "neo4j"
if os.getenv('NEO4J_PASS') is not None:
    NEO4J_PASSWORD = os.getenv('NEO4J_PASS')
else:
    NEO4J_PASSWORD = 'neo4jroot'
NEO4J_CONTAINER = 'neo4j-graphjs'