from neo4j import GraphDatabase

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))

with neo_driver.session() as session:

	query = '''
	MATCH (n)
	DETACH DELETE n
	'''
	results = session.run(query)

	query = '''
	LOAD CSV WITH HEADERS FROM "file:///nodes.csv" AS row FIELDTERMINATOR '¿' 
	WITH row CALL apoc.create.node([row.`Label:LABEL`], row)
	YIELD node
	SET node.Id = row.`Id:ID`
	RETURN node
	'''
	results = session.run(query)

	query = '''
	CALL apoc.periodic.iterate(
	"LOAD CSV WITH HEADERS FROM "file:///rels.csv" AS row FIELDTERMINATOR '¿'
	MATCH (n1 {Id: row.`FromId:START_ID`})
	MATCH (n2 {Id:row.`ToId:END_ID`})
	CREATE (n1)-[r:RELTYPE]->(n2)
	RETURN NULL",
	{{batchSize:1000, parallel: true})
	'''

	results = session.run(query)
	#CALL apoc.create.relationship(n1, row.`RelationLabel:TYPE`, row, n2) YIELD rel
