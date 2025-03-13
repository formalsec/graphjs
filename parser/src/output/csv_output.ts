import fs from "fs";
import { OutputWriter } from "./output_writer";
import path from "path";
import { type Graph } from "../traverse/graph/graph";
import { type GraphNode } from "../traverse/graph/node";
import { type GraphEdge } from "../traverse/graph/edge";
import { type Literal } from "estree";
import escodegen from "escodegen";

export class CSVOutput extends OutputWriter {
    private showCode: any;
    output(graph: Graph, options: any, fileDir: string): void {
        this.showCode = options.show_code || false;
        // NODES
        // Id:ID¿Type¿IdentifierName¿Raw¿InternalStructure¿Location¿Code¿Label:LABEL

        const nodesWriteStream = fs.createWriteStream(path.join(fileDir, "nodes.csv"));
        nodesWriteStream.write("Id:ID¿Type¿SubType¿FunctionContext¿IdentifierName¿Raw¿InternalStructure¿Location¿Code¿Label:LABEL\n");

        graph.nodes.forEach((node: GraphNode) => {
            const n = [];

            // node id
            n.push(node.id);

            // node type
            n.push(node.type);

            // node subtype
            n.push(node.subtype)

            // node function context
            n.push(node.functionContext)

            // node identifier name
            switch (node.type) {
                case "Identifier":
                case "VariableDeclarator":
                case "FunctionDeclaration":
                case "FunctionExpression":
                case "PDG_OBJECT":
                case "PDG_PARAM":
                case "PDG_CALL":
                case "PDG_RETURN":
                case "CFG_F_START":
                case "CFG_F_END":
                case "CFG_IF_END":
                case "TAINT_SINK":
                case "TAINT_SOURCE":
                    n.push(node.identifier);
                    break;

                default:
                    n.push("");
            }

            // Raw
            if (node.type === "Literal") {
                const lit = node.obj as Literal;
                if (lit.raw) lit.raw = lit.raw.replace(/"/g, "'")
                n.push(lit.raw);
            } else n.push("");

            // Internal Structure
            if (node.internalStructure) {
                n.push(JSON.stringify(node.internalStructure));
            } else n.push("");

            // code location
            if (node.obj.loc) n.push(JSON.stringify(node.obj.loc));
            else n.push("");

            if (this.showCode && ["VariableDeclarator", "ExpressionStatement", "ReturnStatement"].includes(node.type)) {
                const code = JSON.stringify(escodegen.generate(node.obj));
                n.push(code);
            } else n.push("");

            // label
            n.push(node.type);

            nodesWriteStream.write(`${n.join("¿")}\n`);
        });
        nodesWriteStream.close();

        // RELS
        // FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿ArgumentIndex

        const edgesWriteStream = fs.createWriteStream(path.join(fileDir, "rels.csv"));
        edgesWriteStream.write("FromId:START_ID¿ToId:END_ID¿RelationLabel:TYPE¿RelationType¿IdentifierName¿ArgumentIndex¿ParamIndex¿StmtIndex¿ElementIndex¿ExpressionIndex¿MethodIndex¿SourceObjName¿IsProp\n");

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

            // param index
            if (edge.paramIndex) e.push(edge.paramIndex);
            else e.push("");

            // stmt index
            if (edge.stmtIndex) e.push(edge.stmtIndex);
            else e.push("");

            // element index
            if (edge.elementIndex) e.push(edge.elementIndex);
            else e.push("");

            // expression index
            if (edge.expressionIndex) e.push(edge.expressionIndex);
            else e.push("");

            // expression index
            if (edge.methodIndex) e.push(edge.methodIndex);
            else e.push("");

            // source obj name
            if (edge.sourceObjName) e.push(edge.sourceObjName);
            else e.push("");

            // is dependency of property
            if (edge.isPropertyDependency) e.push(edge.isPropertyDependency);
            else e.push(false);

            edgesWriteStream.write(`${e.join("¿")}\n`);
        });
        edgesWriteStream.close();
    }
}
