const { Node } = require("./node");
const { Edge } = require("./edge");

class Graph {
    constructor(outputManager) {
        this.nodeCounter = 0;
        this.edgeCounter = 0;

        this._nodes = new Map();
        this._edges = new Map();
        this._outputManager = outputManager;
        this._startNodes = {};
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

    /**
     * @param {OutputManager} outputManager
     */
    set outputManager(outputManager) {
        this._outputManager = outputManager;
    }

    addNode(label, obj) {
        // eslint-disable-next-line no-plusplus
        const id = this.nodeCounter++;
        const node = new Node(id, label, obj);
        this.nodes.set(id, node);
        return node;
    }

    addEdge(nodeId1, nodeId2, edgeInfo) {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        // eslint-disable-next-line no-plusplus
        const id = this.edgeCounter++;
        const edge = new Edge(id, node1, node2, edgeInfo);
        this.edges.set(id, edge);

        node1.addEdge(edge);
        return edge;
    }

    addStartNodes(nodeType, startNode) {
        if (Object.prototype.hasOwnProperty.call(this.startNodes, nodeType)) {
            this.startNodes[nodeType].push(startNode);
        } else {
            this.startNodes[nodeType] = [startNode];
        }
    }

    output(filename) {
        this._outputManager.output(this, filename);
    }
}

module.exports = { Graph };
