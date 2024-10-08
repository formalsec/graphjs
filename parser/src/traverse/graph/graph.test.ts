import { OutputWriter } from "../../output/output_writer";
import { OutputManager } from "../../output/output_strategy";
import { Graph } from "./graph";
import { type GraphNode } from "./node";

describe("Testing graph class", () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph(null);
    });

    test("create a graph instance", () => {
        expect(graph).toBeInstanceOf(Graph);
    });

    test("create nodes using the graph instance", () => {
        const localNodes = new Map();
        const n1 = graph.addNode("Node1", {});
        const n2 = graph.addNode("Node2", {});
        localNodes.set(n1.id, n1);
        localNodes.set(n2.id, n2);

        expect(graph.nodes.size).toBe(2);
        expect(graph.nodes).toEqual(localNodes);
    });

    test("create edge using the graph instance", () => {
        const n1 = graph.addNode("Node1", {});
        const n2 = graph.addNode("Node2", {});

        const edgeInfo = {
            type: "EdgeType",
            label: "EdgeLabel",
            argument_index: 1,
            param_index: 2,
            stmt_index: 3
        };

        const localEdges = new Map();
        const edge = graph.addEdge(n1.id, n2.id, edgeInfo);
        if (edge) localEdges.set(edge.id, edge);

        expect(graph.edges.size).toBe(1);
        expect(graph.edges).toEqual(localEdges);
    });

    test("add nodes to start nodes of graph instance", () => {
        const nodes = new Map<string, GraphNode[]>();

        expect(graph.startNodes.size).toBe(0);

        const n1 = graph.addNode("Node1", {});
        graph.addStartNodes("nodeType1", n1);
        expect(graph.startNodes.size).toBe(1);
        nodes.set("nodeType1", [n1]);
        expect(graph.startNodes).toEqual(nodes);

        const n2 = graph.addNode("Node2", {});
        graph.addStartNodes("nodeType1", n2);
        expect(graph.startNodes.size).toBe(1);
        nodes.set("nodeType1", [n1, n2]);
        expect(graph.startNodes).toEqual(nodes);

        const n3 = graph.addNode("Node3", {});
        graph.addStartNodes("nodeType2", n3);
        expect(graph.startNodes.size).toBe(2);
        nodes.set("nodeType2", [n3]);
        expect(graph.startNodes).toEqual(nodes);
    });

    test("check if number of nodes matches", () => {
        graph.addNode("Node1", {});
        graph.addNode("Node2", {});
        expect(graph.nodes.size).toBe(2);
        expect(graph.number_nodes).toBe(2);
    });

    test("check if number of edges matches", () => {
        const n1 = graph.addNode("Node1", {});
        const n2 = graph.addNode("Node2", {});
        graph.addEdge(n1.id, n2.id, {});

        expect(graph.edges.size).toBe(1);
        expect(graph.number_edges).toBe(1);

        const n3 = graph.addNode("Node3", {});
        const n4 = graph.addNode("Node4", {});
        graph.addEdge(n3.id, n4.id, {});

        expect(graph.edges.size).toBe(2);
        expect(graph.number_edges).toBe(2);
    });

    test("check if output manager matches", () => {
        let testNumber = 0;
        class LocalOutput extends OutputWriter {
            output(graph: Graph, options: any, filename: string): number {
                testNumber = 1;
                return testNumber;
            }
        }

        graph.outputManager = new OutputManager({}, new LocalOutput());
        graph.output("");
        expect(testNumber).toBe(1);
    });
});
