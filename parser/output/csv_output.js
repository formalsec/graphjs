const fs = require('fs');

class CSVOutput {
    output(graph, options, filename) {

        // NODES
        // Id:ID¿Type¿Raw¿Location¿Label:LABEL
        
        const nodesWriteStream = fs.createWriteStream(`${filename}_nodes.csv`);
        // nodesWriteStream.write('Id:ID¿Type¿Raw¿Location¿Label:LABEL\n');
        nodesWriteStream.write('Id:ID¿Type¿IdentifierName¿Location¿Label:LABEL\n');

        graph.nodes.forEach(node =>{
            const n = [];

            // node id
            n.push(node.id);

            // node type
            n.push(node.type);

            // raw node
            //n.push(JSON.stringify(node.obj));

            // node identifier name
            switch(node.type) {
                case 'Identifier':
                case 'FunctionDeclaration':
                case 'PDG_OBJECT':
                case 'CFG_MAIN_START':
                case 'CFG_MAIN_END':
                case 'CFG_FUNC_START':
                case 'CFG_FUNC_END':
                case 'CFG_IF_END':
                    n.push(node.identifier);
                    break;
                
                default:
                    n.push('');
            }
            // if (node.type == 'Identifier' || node.type == 'FunctionDeclaration' || node.type == 'OBJECT') n.push(node.identifier)
            // else n.push('')

            // code location
            if (node.obj.loc) n.push(JSON.stringify(node.obj.loc));
            else n.push('');
            
            // node label
            //n.push('')
            n.push(node.type);

            nodesWriteStream.write(`${n.join('¿')}\n`);
        });
        nodesWriteStream.close()

        
        // RELS
        // FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿Arguments
        
        const edgesWriteStream = fs.createWriteStream(`${filename}_rels.csv`);
        edgesWriteStream.write('FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿IdentifierName¿Arguments\n');

        graph.edges.forEach(edge => {
            const e = [];
            let [n1, n2] = edge.nodes;

            // from and to nodes
            e.push(n1.id);
            e.push(n2.id);

            // relation label
            e.push(edge.type);

            // relation type
            if (edge.label) e.push(edge.label);
            else e.push('');

            if (edge.obj_name) e.push(edge.obj_name)
            else e.push('')

            // arguments
            e.push(JSON.stringify({}));

            edgesWriteStream.write(`${e.join('¿')}\n`);
        });
        edgesWriteStream.close();
    }
}

module.exports = {
    CSVOutput,
};