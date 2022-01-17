import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { clone } from "../utils/utils";

type Heap = Map<string, Object>;
type Store = Map<string, Object>;
type Phi = Map<string, number>;

interface DepAnalysisStepReturn {
    heap: Heap,
    store: Store,
    phi: Phi,
};

function printAuxiliaryStructures(heap: Heap, store: Store, phi: Phi) {
    console.log(heap);
    console.log(store);
    console.log(phi);
}

function handleExpressionStatement(node: GraphNode, oldHeap: Heap, oldStore: Store, oldPhi: Phi): DepAnalysisStepReturn {
    const heap = clone(oldHeap);
    const store = clone(oldStore);
    const phi = clone(oldPhi);

    return { heap, store, phi };
}

export function buildPDG(cfgGraph: Graph): Graph {
    const graph = cfgGraph;
    const startNodes = graph.startNodes.get("CFG");

    // Heap - Locations -> Objects
    let heap: Heap = new Map();

    // Store - Variable -> Locations
    let store: Store = new Map();

    // Phi - Variable -> Statement Node Id
    let phi: Phi = new Map();

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode) {
        if (node === null) return;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        console.log(node.id, node.type);

        switch (node.type) {
            case "ExpressionStatement": {
                ({ heap, store, phi } = handleExpressionStatement(node, heap, store, phi));
                break;
            }

            default:
                break;
        }

        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                traverse(n);
            });
    }

    startNodes?.forEach((node: GraphNode) => {
        traverse(node);
    });


    printAuxiliaryStructures(heap, store, phi);
    return graph;
}
