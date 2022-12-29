import { GraphNode } from "./node";
import { GraphEdge } from "./edge";
import { OutputManager } from "../../output/output_strategy";

export class Graph {
    private nodeCounter: number;
    private edgeCounter: number;
    private _nodes: Map<number, GraphNode>;
    private _edges: Map<number, GraphEdge>;
    private _outputManager: OutputManager | null;
    private _startNodes: Map<string, GraphNode[]>; // Change this to a custom type
    private _taintNode: number;
    private _sinkNodes: Map<string, number>;

    constructor(outputManager: OutputManager | null) {
        this.nodeCounter = 0;
        this.edgeCounter = 0;

        this._nodes = new Map();
        this._edges = new Map();

        this._outputManager = outputManager;
        this._startNodes = new Map();

        this._taintNode = -1;
        this._sinkNodes = new Map();
    }

    get nodes() {
        return this._nodes;
    }

    get edges() {
        return this._edges;
    }

    get number_nodes() {
        return this.nodeCounter;
    }

    get number_edges() {
        return this.edgeCounter;
    }

    get startNodes() {
        return this._startNodes;
    }

    get taintNode() {
        return this._taintNode;
    }

    get sinkNodes() {
        return this._sinkNodes;
    }

    /**
     * @param {OutputManager} outputManager
     */
    set outputManager(outputManager: OutputManager) {
        this._outputManager = outputManager;
    }

    addTaintNode() {
        // eslint-disable-next-line no-plusplus
        const id = this.nodeCounter++;
        const node = new GraphNode(id, "TAINT_SOURCE", { type: "TAINT" });
        this.nodes.set(id, node);
        this._taintNode = id;
        return node;
    }

    addSinkNode(sink: string): GraphNode {
        // eslint-disable-next-line no-plusplus
        const id = this.nodeCounter++;
        const node = new GraphNode(id, "TAINT_SINK", { type: "TAINT", label: sink });
        node.identifier = sink;
        this.nodes.set(id, node);
        this._sinkNodes.set(sink, id);
        return node;
    }

    addNode(label: string, obj: any) {
        // eslint-disable-next-line no-plusplus
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

    addStartNodes(nodeType: string, startNode: GraphNode) {
        const oldNodeArray = this._startNodes.get(nodeType);
        if (oldNodeArray) {
            oldNodeArray.push(startNode);
            this._startNodes.set(nodeType, oldNodeArray);
        } else {
            this._startNodes.set(nodeType, [startNode]);
        }
    }



    clearUnusedObjectNodes() {
        this._nodes = new Map([...this._nodes].filter((n) => n[1].used));
        this._edges = new Map([...this._edges].filter((e) => e[1].nodes[0].used && e[1].nodes[1].used));
    }

    output(filename: string) {
        if (this._outputManager) this._outputManager.output(this, filename);
        else console.log("Output Manager is null");
    }
}
