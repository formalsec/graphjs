const {Node, Edge, Graph} = require('./graph');

describe('Testing node class', () => {

    let node, node_id, node_type, node_obj;

    beforeEach(() => {
        node_id = 1;
        node_type = "Test";
        node_obj = { t: "test" };
        node = new Node(node_id, node_type, node_obj);
    });

    test('create a node instance', () => {
        expect(node).toBeInstanceOf(Node);
    });

    test('make sure node id matches', () => {
        expect(node.id).toBe(node_id);
    });

    test('make sure node type matches', () => {
        expect(node.type).toBe(node_type);
    });

    test('make sure node obj matches', () => {
        expect(node.obj).toBe(node_obj);

        const new_obj = { t2: "test2" };
        node.obj = new_obj;
        expect(node.obj).toBe(new_obj);
    });

    test('make sure node edges match', () => {
        expect(node.edges.length).toBe(0);
        expect(node.edges).toEqual([]);

        const new_edges = ["E1", "E2", "E3"];
        new_edges.forEach(e => node.addEdge(e));
        expect(node.edges.length).toBe(new_edges.length);
        expect(node.edges).toEqual(new_edges);
    });

});