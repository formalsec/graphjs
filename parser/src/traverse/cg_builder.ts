import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../utils/utils";

type GFunctions = Map<string, Map<string, number>>;

class GraphFunctions {
    private gFunctions: GFunctions;
    private intraContextStack: string[];

    constructor() {
        this.gFunctions = new Map();
        this.intraContextStack = new Array<string>();
    }

    pushContext(namespace: string) {
        this.intraContextStack.push(namespace);
    }

    popContext(): string | undefined {
        return this.intraContextStack.pop();
    }

    getRecentContext(): string {
        return this.intraContextStack.slice(-1)[0];
    }

    getParentContext(): string {
        // console.log(this.intraContextStack);
        return this.intraContextStack[0];
    }

    addFunctionToContext(functionNode: GraphNode) {
        if (functionNode.functionName) {
            const context = this.getRecentContext();
            let contextMap = this.gFunctions.get(context);
            if (!contextMap) {
                contextMap = new Map();
            }
            contextMap.set(functionNode.functionName, functionNode.id);
            this.gFunctions.set(context, contextMap);
        }
    }

    addFunctionCall(stmtId: number, callee: GraphNode, graph: Graph) {
        const functionName = callee.identifier;
        const context = this.getParentContext();
        const contextMap = this.gFunctions.get(context);

        if (contextMap && functionName) {
            const fStartNodeId = contextMap.get(functionName);
            if (fStartNodeId) graph.addEdge(stmtId, fStartNodeId, { type: "CG", label: "CG" });
        }
    }

    print() {
        console.log("Functions:", this.gFunctions);
    }
}

/* eslint-disable consistent-return */
function buildCallGraph(pdgGraph: Graph) {
    const graph = pdgGraph;
    const gFunctions = new GraphFunctions();
    const visitedNodes: number[] = [];

    function traverseCFG(defNode: GraphNode) {
        // console.log(defNode.type, defNode.namespace);
        defNode.edges
            .filter((edge: GraphEdge) => edge.type == "CFG")
            .map((edge: GraphEdge) => traverse(edge.nodes[1]));
    }

    function traverse(node: GraphNode): void {

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        switch (node.type) {
            case "CFG_F_START": {
                if (node.namespace) {
                    gFunctions.pushContext(node.namespace);
                }
                traverseCFG(node);
                break;
            }

            case "CFG_F_END": {
                gFunctions.popContext();
                traverseCFG(node);
                break;
            }

            case "VariableDeclarator": {
                // check init
                // if function add to context for future processing
                const init = getASTNode(node, "init");

                if (init && init.type == "CallExpression") {
                    const callee = getASTNode(init, "callee");
                    gFunctions.addFunctionCall(node.id, callee, graph);
                } else {
                    const fd = getFDNode(node);
                    if (fd) {
                        gFunctions.addFunctionToContext(fd);
                        traverse(fd);
                    }
                }
                traverseCFG(node);
                break;
            }

            default:
                traverseCFG(node);

        }
    }

    graph.startNodes.get("CFG")?.forEach(n => traverse(n));
    gFunctions.print();
    return graph;
}

module.exports = { buildCallGraph };
