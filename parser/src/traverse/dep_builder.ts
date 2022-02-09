import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { clone, getNextObjectName } from "../utils/utils";

interface GraphOperation {
    op: string,
    name: string,
    source: number,
    destination?: number,
};

type Heap = Map<string, Object>;
type Store = Map<string, Object>;
type Phi = Map<string, number>;
type Dependencytrackers = {
    "heap": Heap,
    "store": Store,
    "phi": Phi,
    "gChanges": Array<GraphOperation>,
};

function printAuxiliaryStructures(trackers: Dependencytrackers) {
    console.log("Heap:", trackers.heap);
    console.log("Store:", trackers.store);
    console.log("Phi:", trackers.phi);
    console.log("Graph:", trackers.gChanges);
}

function getASTNode(parent: GraphNode, childLabel: string): GraphNode {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel)[0].nodes[1];
}

function handleAssignmentRight(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: Dependencytrackers): Dependencytrackers {

    switch (right.type) {
        case "ObjectExpression": {
            const leftIdentifier = left.obj.name;
            const newObjName = getNextObjectName();
            trackers.heap.set(newObjName, {});
            trackers.store.set(leftIdentifier, newObjName);
            trackers.phi.set(leftIdentifier, stmtId);
            trackers.gChanges = [
                {
                    op: "OBJECT",
                    source: stmtId,
                    name: newObjName,
                }
            ];
        }
    }

    return trackers;
}

function handleAssignmentExpression(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: Dependencytrackers): Dependencytrackers {

    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleAssignmentRight(stmtId, parent, left, right, trackers);
        }

        // object write
        case "MemberExpression": {
            break;
        }
    }

    return trackers
}

function handleExpressionStatement(stmtId: number, node: GraphNode, trackers: Dependencytrackers): Dependencytrackers {

    switch (node.type) {
        case "AssignmentExpression": {
            const left = getASTNode(node, "left");
            const right = getASTNode(node, "right");
            return handleAssignmentExpression(stmtId, node, left, right, trackers);
        }
    }

    return trackers;
}

export function buildPDG(cfgGraph: Graph): Graph {
    const graph = cfgGraph;

    // Heap - Locations -> Objects
    let heap: Heap = new Map();

    // Store - Variable -> Locations
    let store: Store = new Map();

    // Phi - Variable -> Statement Node Id
    let phi: Phi = new Map();

    let trackers: Dependencytrackers = {
        "heap": heap,
        "store": store,
        "phi": phi,
        "gChanges": [],
    };

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode) {
        if (node === null) return;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        console.log(node.id, node.type);

        // check all possible statements after normalization
        switch (node.type) {

            // expression statements are the majority of statements
            case "ExpressionStatement": {
                const expressionNode = getASTNode(node, "expression");
                if (expressionNode)
                    trackers = handleExpressionStatement(node.id, expressionNode, trackers);
                break;
            }

            default:
                break;
        }

        // perform graph changes according to log gChnages object
        trackers.gChanges.forEach(change => {
            switch (change.op) {
                case "OBJECT": {
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    nodeObj.identifier = change.name;
                    graph.addEdge(change.source, nodeObj.id, { type: "PDG", label: "CREATE", objName: change.name });
                }
            }
        });
        trackers.gChanges = [];

        // traverse all child CFG nodes
        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                traverse(n);
            });
    }

    // traverse CFG nodes
    const startNodes = graph.startNodes.get("CFG");
    startNodes?.forEach((node: GraphNode) => {
        traverse(node);
    });


    printAuxiliaryStructures(trackers);
    return graph;
}
