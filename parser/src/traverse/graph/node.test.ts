import { GraphEdge } from "./edge";
import { GraphNode } from "./node";

describe("Testing node class", () => {
    let node: GraphNode;
    let nodeId: number;
    let nodeType: string;
    let nodeObj: any;
    let nodeIdentifier: string;
    let nodeNamespace: string;

    beforeEach(() => {
        nodeId = 1;
        nodeType = "Test";
        nodeObj = { t: "test" };
        nodeIdentifier = "identifier";
        nodeNamespace = "namespace";
        node = new GraphNode(nodeId, nodeType, nodeObj);
        node.identifier = nodeIdentifier;
        node.namespace = nodeNamespace;
    });

    test("create a node instance", () => {
        expect(node).toBeInstanceOf(GraphNode);
    });

    test("make sure node id matches", () => {
        expect(node.id).toBe(nodeId);
    });

    test("make sure node type matches", () => {
        expect(node.type).toBe(nodeType);
    });

    test("make sure node obj matches", () => {
        expect(node.obj).toBe(nodeObj);

        const newObj = { t2: "test2" };
        node.obj = newObj;
        expect(node.obj).toBe(newObj);
    });

    test("make sure node edges match", () => {
        expect(node.edges.length).toBe(0);
        expect(node.edges).toEqual([]);

        const newEdges: GraphEdge[] = [
            new GraphEdge(1, node, node, {}),
            new GraphEdge(2, node, node, {}),
            new GraphEdge(3, node, node, {})
        ];
        newEdges.forEach((e: GraphEdge) => node.addEdge(e));
        expect(node.edges.length).toBe(newEdges.length);
        expect(node.edges).toEqual(newEdges);
    });

    test("make sure node identifier matches", () => {
        expect(node.identifier).toBe(nodeIdentifier);
    });

    test("make sure node namespace matches", () => {
        expect(node.namespace).toBe(nodeNamespace);
    });

    test("make sure node is visitor", () => {
        let testNumber = 0;
        const changeTestNumber = () => { testNumber = 1; };
        const visitor = {
            visit: () => { changeTestNumber(); },
        };

        node.accept(visitor);
        expect(testNumber).toBe(1);
    });
});
