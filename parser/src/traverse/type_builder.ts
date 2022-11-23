import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../utils/utils";
import { FunctionObjects, buildTypesFromExpressionStatement, buildTypesFromVariableAssignment } from "./types_builder_utils";

/* eslint-disable consistent-return */
function buildTypes(graph: Graph) {
    const newGraph = graph;
    const visitedNodes: number[] = [];
    let fObjects = new FunctionObjects()

    function traverseCFG(node: GraphNode, graph: Graph, functionId: number) {
        if (node.type === "CFG_F_END") return;
        console.log(node.id, node.type);
        // expression statements are the majority of statements
        switch (node.type) {
            case "ExpressionStatement": {
                fObjects = buildTypesFromExpressionStatement(node, newGraph, functionId, fObjects);
                break;
            }

            case "VariableDeclarator": {
                fObjects = buildTypesFromVariableAssignment(node, newGraph, functionId, fObjects);
                break;
            }
        }

        node.edges
            .filter((edge) => edge.type == "CFG")
            .map((edge) => {
                const n = edge.nodes[1];
                traverseCFG(n, graph, functionId);
            });
    }

    function traverse(node: GraphNode): void {
        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        if (node.type == "CFG_F_START") {
            const functionId = node.functionNodeId;
            const func = graph.nodes.get(functionId);
            if (func) {
                const funcParams = getAllASTNodes(func, "param");
                if (funcParams.length == 0) return;
                funcParams.forEach((param) => {
                    fObjects.addParam(func.id, param.obj.name);
                });
            }

            node.edges
            .filter((edge) => edge.type == "CFG")
            .map((edge) => {
                const n = edge.nodes[1];
                traverseCFG(n, graph, functionId);
            });
        }
    }

    newGraph.startNodes.get("CFG")?.forEach(n => traverse(n));
    fObjects.print();
    return newGraph;
}

module.exports = { buildTypes };
