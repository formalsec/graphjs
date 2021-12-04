/* eslint-disable no-undef */
const { Edge } = require("./edge");
const { Node } = require("./node");

describe("Testing edge class", () => {
    let edge;
    let edgeId;
    let node1;
    let node2;

    beforeEach(() => {
        edgeId = 3;
        edgeInfo = {
            type: "EdgeType",
            label: "EdgeLabel",
            argumentIndex: 1,
            paramIndex: 2,
            stmtIndex: 3,
        };

        node1 = new Node(1, "Node1");
        node2 = new Node(2, "Node2");

        edge = new Edge(edgeId, node1, node2, edgeInfo);
    });

    test("create an edge instance", () => {
        expect(edge).toBeInstanceOf(Edge);
    });

    test("make sure edge id matches", () => {
        expect(edge.id).toBe(edgeId);
    });

    test("make sure edge nodes match", () => {
        expect(edge.nodes.length).toBe(2);
        expect(edge.nodes).toEqual([node1, node2]);
    });

    test("make sure edge type matches", () => {
        expect(edge.type).toBe(edgeInfo.type);
    });

    test("make sure edge label matches", () => {
        expect(edge.label).toBe(edgeInfo.label);
    });

    test("make sure edge obj_name matches", () => {
        expect(edge.objName).toBe("");
    });

    test("make sure edge argument_index matches", () => {
        expect(edge.argumentIndex).toBe(edgeInfo.argumentIndex);
    });

    test("make sure edge param_index matches", () => {
        expect(edge.paramIndex).toBe(edgeInfo.paramIndex);
    });

    test("make sure edge stmt_index matches", () => {
        expect(edge.stmtIndex).toBe(edgeInfo.stmtIndex);
    });
});
