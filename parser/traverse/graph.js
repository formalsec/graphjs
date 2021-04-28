class Node {
    constructor(id, type, obj={}) {
        this._id = id;
        this._type = type;
        this._obj = obj;
        this._edges = [];
    }

    get id() {
        return this._id;
    }

    get type() {
        return this._type;
    }

    get obj() {
        return this._obj;
    }

    set obj(obj) {
        this._obj = obj;
    }

    get edges() {
        return this._edges;
    }

    addEdge(edge) {
        this._edges.push(edge);
    }

    accept(visitor) {
        visitor.visit(this);
    }
}

class Edge {
    constructor(id, node_1, node_2, edge_info) {
        this._id = id;
        this._nodes = [node_1, node_2];

        this._type = edge_info.type;
        this._label = edge_info.label;
    }

    get nodes() {
        return this._nodes;
    }

    get type() {
        return this._type;
    }

    get label() {
        return this._label;
    }
}

class Graph {
    constructor(output_manager) {
        this.node_counter = 0;
        this.edge_counter = 0;

        this._nodes = new Map();
        this._edges = new Map();
        this._output_manager = output_manager;
    }

    get nodes() {
        return this._nodes;
    }

    get edges() {
        return this._edges;
    }

    get number_nodes() {
        return this.node_counter;
    }

    get number_edges() {
        return this.edge_counter;
    }

    set output_manager(output_manager) {
        this._output_manager = output_manager;
    }

    addNode(label, obj) {
        const count = this.node_counter++;
        const id = obj && obj._id ? obj._id : count;
        const node = new Node(id, label, obj);
        this._nodes.set(id, node);
        return node;
    }

    addEdge(node_id_1, node_id_2, edge_info) {
        const node_1 = this._nodes.get(node_id_1);
        const node_2 = this._nodes.get(node_id_2);
        
        const id = this.edge_counter++;
        const edge = new Edge(id, node_1, node_2, edge_info);
        this._edges.set(id, edge);

        node_1.addEdge(edge);
        node_2.addEdge(edge);
        return edge;
    }

    output(filename) {
        this._output_manager.output(this, filename);
    }
}

module.exports = { Node, Edge, Graph };

// const { OutputManager, DotOutput } = require('../output/output_strategy');

// const output_manager = new OutputManager();
// output_manager.writer = new DotOutput();

// const g = new Graph(output_manager);
// const program = g.addNode('Program');
// const if_stmt = g.addNode('IfStatement');

// g.addEdge(program.id, if_stmt.id, { type: 'AST', label: 1 });

// const i = g.addNode('Identifier', {
//     type: "Identifier",
//     name: "i"
// });
// g.addEdge(if_stmt.id, i.id, { type: 'AST', label: 'test' });

// // -----------------------------

// const consequent = g.addNode('BlockStatement');
// g.addEdge(if_stmt.id, consequent.id, { type: 'AST', label: 'consequent' });

// const expr_stmt_1 = g.addNode('ExpressionStatement');
// g.addEdge(consequent.id, expr_stmt_1.id, { type: 'AST', label: 1 });

// const update_expr_1 = g.addNode('UpdateExpression', { operator: '++' });
// g.addEdge(expr_stmt_1.id, update_expr_1.id, { type: 'AST', label: 'expression' });

// const i2 = g.addNode('Identifier', {
//     type: "Identifier",
//     name: "i"
// });
// g.addEdge(update_expr_1.id, i2.id, { type: 'AST', label: 'argument' });

// // --------------

// const alternate = g.addNode('BlockStatement');
// g.addEdge(if_stmt.id, alternate.id, { type: 'AST', label: 'alternate' });

// const expr_stmt_2 = g.addNode('ExpressionStatement');
// g.addEdge(alternate.id, expr_stmt_2.id, { type: 'AST', label: 1 });

// const update_expr_2 = g.addNode('UpdateExpression', { operator: '--' });
// g.addEdge(expr_stmt_2.id, update_expr_2.id, { type: 'AST', label: 'expression' });

// const i3 = g.addNode('Identifier', {
//     type: 'Identifier',
//     name: 'i'
// });
// g.addEdge(update_expr_2.id, i3.id, { type: 'AST', label: 'argument' });

// // ------------------
// // CFG
// const _start = g.addNode('_start');
// const _end = g.addNode('_end');

// g.addEdge(_start.id, if_stmt.id, { type: 'CFG' });
// g.addEdge(if_stmt.id, i.id, { type: 'CFG', label: 'test' });

// g.addEdge(i.id, consequent.id, { type: 'CFG', label: 'TRUE' });
// g.addEdge(consequent.id, expr_stmt_1.id, { type: 'CFG' });
// g.addEdge(expr_stmt_1.id, update_expr_1.id, { type: 'CFG' });
// g.addEdge(update_expr_1.id, i2.id, { type: 'CFG' });
// g.addEdge(i2.id, _end.id, { type: 'CFG' });

// g.addEdge(i.id, alternate.id, { type: 'CFG', label: 'FALSE' });
// g.addEdge(alternate.id, expr_stmt_2.id, { type: 'CFG' });
// g.addEdge(expr_stmt_2.id, update_expr_2.id, { type: 'CFG' });
// g.addEdge(update_expr_2.id, i3.id, { type: 'CFG' });
// g.addEdge(i3.id, _end.id, { type: 'CFG' });

// g.output('graph');