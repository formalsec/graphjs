from neo4j import GraphDatabase

NEO4J_CONN_STRING="bolt://127.0.0.1:7687"

neo_driver = GraphDatabase.driver(NEO4J_CONN_STRING, auth=('', ''))
with neo_driver.session() as session:
	with session.begin_transaction() as tx:
		# select all identifiers
        # match (f:FunctionDeclaration)-[:PDG {RelationType:'CREATE'}]->(o) Return f,o
		query = """
			MATCH (f:FunctionDeclaration)-[:PDG {RelationType:'CREATE'}]-(o:PDG_OBJECT),
                (o)-[w:PDG {RelationType:'WRITE'}]-(y),
                (o)-[l:PDG {RelationType:'LOOKUP', IdentifierName:w.IdentifierName}]-(x)-[:PDG {RelationType:'VAR'}]-(vd:VariableDeclarator)-[:AST]-(c:CallExpression)-[:AST]-(e:Identifier {IdentifierName: 'eval'})
            RETURN *
		"""
		results= tx.run(query)
		if len(results.keys()) > 0:
			#print("Vulnerable")
			for record in results:
				print(record)
		else:
			print("Not Vulnerable")