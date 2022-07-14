import fs from "fs";
import { OutputWriter } from "./output_writer";

import { Graph } from "../traverse/graph/graph";
import { GraphNode } from "../traverse/graph/node";
import { GraphEdge } from "../traverse/graph/edge";

export class CSVOutput extends OutputWriter {
    // eslint-disable-next-line class-methods-use-this
    output(graph: Graph, options: any, filename: string) {
        // NODES
        // Id:ID¿Type¿Raw¿Location¿Label:LABEL

        const nodesWriteStream = fs.createWriteStream(`${filename}_nodes.csv`);
        // nodesWriteStream.write('Id:ID¿Type¿Raw¿Location¿Label:LABEL\n');
        nodesWriteStream.write("Id:ID¿Type¿IdentifierName¿Location¿Label:LABEL\n");

        graph.nodes.forEach((node: GraphNode) => {
            const n = [];

            // node id
            n.push(node.id);

            // node type
            n.push(node.type);

            // node identifier name
            switch (node.type) {
            case "Identifier":
            case "VariableDeclarator":
            case "FunctionDeclaration":
            case "PDG_OBJECT":
            case "CFG_F_START":
            case "CFG_F_END":
            case "CFG_IF_END":
                n.push(node.identifier);
                break;

            default:
                n.push("");
            }

            // code location
            if (node.obj.loc) n.push(JSON.stringify(node.obj.loc));
            else n.push("");

            n.push(node.type);

            nodesWriteStream.write(`${n.join("¿")}\n`);
        });
        nodesWriteStream.close();

        // RELS
        // FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿ArgumentIndex

        const edgesWriteStream = fs.createWriteStream(`${filename}_rels.csv`);
        edgesWriteStream.write("FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿IdentifierName¿ArgumentIndex\n");

        graph.edges.forEach((edge: GraphEdge) => {
            const e = [];
            const [n1, n2] = edge.nodes;

            // from and to nodes
            e.push(n1.id);
            e.push(n2.id);

            // relation label
            e.push(edge.type);

            // relation type
            if (edge.label) e.push(edge.label);
            else e.push("");

            if (edge.objName) e.push(edge.objName);
            else e.push("");

            // argument index
            if (edge.argumentIndex) e.push(edge.argumentIndex);
            else e.push("");

            edgesWriteStream.write(`${e.join("¿")}\n`);
        });
        edgesWriteStream.close();
    }
}
