import { GraphNode } from "./node";
import { GraphEdge } from "./edge";
import { type OutputManager } from "../../output/output_strategy";

export class Graph {
    private nodeCounter: number;
    private edgeCounter: number;
    private _nodes: Map<number, GraphNode>;
    private _edges: Map<number, GraphEdge>;
    private _outputManager: OutputManager | null;
    private _startNodes: Map<string, GraphNode[]>; // Change this to a custom type
    private _taintNode: number;
    private _sinkNodes: Map<string, number>;

    constructor(outputManager: OutputManager | null,nodeCounter:number = 0,edgeCounter:number =0) {
        this.nodeCounter = nodeCounter;
        this.edgeCounter = edgeCounter;

        this._nodes = new Map();
        this._edges = new Map();

        this._outputManager = outputManager;
        this._startNodes = new Map();

        this._taintNode = -1;
        this._sinkNodes = new Map();
    }

    get nodes(): Map<number, GraphNode> {
        return this._nodes;
    }

    get edges(): Map<number, GraphEdge> {
        return this._edges;
    }

    get number_nodes(): number {
        return this.nodeCounter;
    }

    get number_edges(): number {
        return this.edgeCounter;
    }

    get startNodes(): Map<string, GraphNode[]> {
        return this._startNodes;
    }

    get taintNode(): number {
        return this._taintNode;
    }

    get sinkNodes(): Map<string, number> {
        return this._sinkNodes;
    }

    set outputManager(outputManager: OutputManager) {
        this._outputManager = outputManager;
    }
    

    addTaintNode(): GraphNode {
        const id = this.nodeCounter++;
        const node = new GraphNode(id, "TAINT_SOURCE", { type: "TAINT" });
        this.nodes.set(id, node);
        this._taintNode = id;
        return node;
    }

    addSinkNode(sink: string): GraphNode {
        const id = this.nodeCounter++;
        const node = new GraphNode(id, "TAINT_SINK", { type: "TAINT", label: sink });
        node.identifier = sink;
        this.nodes.set(id, node);
        this._sinkNodes.set(sink, id);
        return node;
    }

    addNode(label: string, obj: any): GraphNode {
        const id = this.nodeCounter++;
        const node = new GraphNode(id, label, obj);
        this.nodes.set(id, node);
        return node;
    }

    addEdge(nodeId1: number, nodeId2: number, edgeInfo: any): GraphEdge | undefined {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        if (node1 && node2) {
            const id = this.edgeCounter++;
            const edge = new GraphEdge(id, node1, node2, edgeInfo);
            this.edges.set(id, edge);
            node1.addEdge(edge);
            return edge;
        }
    }

    addStartNodes(nodeType: string, startNode: GraphNode): void {
        const oldNodeArray = this._startNodes.get(nodeType);
        if (oldNodeArray) {
            oldNodeArray.push(startNode);
            this._startNodes.set(nodeType, oldNodeArray);
        } else {
            this._startNodes.set(nodeType, [startNode]);
        }
    }

    output(filename: string): void {
        if (this._outputManager) this._outputManager.output(this, filename);
        else console.log("Output Manager is null");
    }
}
