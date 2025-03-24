class Load_mdg:
    def __init__(self):
        self.delete = """
            MATCH (n)
            DETACH DELETE n;
        """
        self.load_nodes = """
            LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS row
            FIELDTERMINATOR '¿'  // Delimiter set to ¿ (U+00BF)
            WITH row
            WHERE row.`Id:ID` IS NOT NULL  // Skip rows with null or missing Id
            MERGE (n:$(row.Type) {Id: row.`Id:ID`})
            SET
              n.Type = row.Type,
              n.SubType = row.SubType,
              n.FunctionContext = row.FunctionContext,
              n.IdentifierName = row.IdentifierName,
              n.Raw = row.Raw,
              n.InternalStructure = row.InternalStructure,
              n.Location = row.Location,
              n.Code = row.Code;
        """
        self.load_rels = """
            LOAD CSV WITH HEADERS FROM 'file:///rels.csv' AS row
            FIELDTERMINATOR '¿'  // Delimiter set to ¿ (U+00BF)
            WITH row
            WHERE row.`FromId:START_ID` IS NOT NULL AND row.`ToId:END_ID` IS NOT NULL
            MATCH (start {Id: row.`FromId:START_ID`}), (end {Id: row.`ToId:END_ID`})
            MERGE (start)-[r:$(row.`RelationLabel:TYPE`)]->(end)  // Change `AST` to your default type
            SET
              r.RelationType = row.RelationType,
              r.IdentifierName = row.IdentifierName,
              r.ArgumentIndex = row.ArgumentIndex,
              r.ParamIndex = row.ParamIndex,
              r.StmtIndex = row.StmtIndex,
              r.ElementIndex = row.ElementIndex,
              r.ExpressionIndex = row.ExpressionIndex,
              r.MethodIndex = row.MethodIndex,
              r.SourceObjName = row.SourceObjName,
              r.IsProp = row.IsProp;
        """

    def get_delete_query(self):
        return self.delete

    def get_load_nodes_query(self):
        return self.load_nodes

    def get_load_rels_query(self):
        return self.load_rels
