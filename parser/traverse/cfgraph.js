
let { getNextNodeId } = require('../utils/utils');

// function buildIf(obj) {
//     const { test, consequent, alternate}  = obj;
    
//     const nodes = {};
//     const edges = [];
    
//     const entry_node_id   = getNextNodeId();
//     const exit_node_id    = getNextNodeId();

//     const test_node_id        = getNextNodeId();
//     const consequent_node_id  = getNextNodeId();
//     const alternate_node_id   = getNextNodeId();
    
//     nodes[entry_node_id] = { type: "_root" };
    
//     nodes[test_node_id] = {
//         type: test.type,
//         ...(test.loc && { loc: `${test.loc.start.line}-${test.loc.end.line}` }),
//     };
    
//     nodes[consequent_node_id] = {
//         type: consequent.type,
//         ...(consequent.loc && { loc: `${consequent.loc.start.line}-${consequent.loc.end.line}` }),
//     };
    
//     nodes[alternate_node_id] = {
//         type: alternate.type,
//         ...(alternate.loc && { loc: `${alternate.loc.start.line}-${alternate.loc.end.line}` }),
//     };
    
//     nodes[exit_node_id] = { type: "_end" };
    
//     edges.push({ edge: [entry_node_id, test_node_id], label: "if"});
//     edges.push({ edge: [test_node_id, consequent_node_id], label: "true" });
//     edges.push({ edge: [test_node_id, alternate_node_id], label: "false" });
//     edges.push({ edge: [consequent_node_id, exit_node_id] });
//     edges.push({ edge: [alternate_node_id, exit_node_id] });
    
//     return {
//         data: [{ entry_node_id, exit_node_id, nodes, edges }],
//     };
// }

function buildWhile(obj) {
    const { test, body}  = obj;
    
    const nodes = {};
    const edges = [];

    const entry_node_id   = getNextNodeId();
    const exit_node_id    = getNextNodeId();

    const test_node_id    = getNextNodeId();
    const body_node_id    = getNextNodeId();
    
    nodes[entry_node_id]  = { type: "_root", loc: null };
    nodes[test_node_id]   = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
    nodes[body_node_id]   = { type: body.type, loc: `${body.loc.start.line}-${body.loc.end.line}` };
    nodes[exit_node_id]   = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, test_node_id], label: "while"});
    edges.push({ edge: [test_node_id, body_node_id], label: "true" });
    edges.push({ edge: [body_node_id, test_node_id] });
    edges.push({ edge: [test_node_id, exit_node_id] });
    
    return {
        data: [{ entry_node_id, exit_node_id, nodes, edges }],
    };
}

function buildSwitch(obj) {
    const { discriminant, cases }  = obj;
    
    const nodes = {};
    const edges = [];

    const entry_node_id   = getNextNodeId();
    const exit_node_id    = getNextNodeId();
    
    const discriminant_node_id = getNextNodeId();

    nodes[entry_node_id]          = { type: "_root", loc: null };
    nodes[discriminant_node_id]   = { type: discriminant.type, loc: `${discriminant.loc.start.line}-${discriminant.loc.end.line}` };
    nodes[exit_node_id]           = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, discriminant_node_id], label: "switch"});
    
    let switch_cases_visited = 0;
    const number_switch_cases = cases.length;
    
    cases.forEach((switchCase) => {
        const { test, consequent } = switchCase;
        const switch_case_id = getNextNodeId();
        
        if (test) {
            nodes[switch_case_id] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
            edges.push({ edge: [discriminant_node_id, switch_case_id], label: test.value.toString() });
        } else {
            nodes[switch_case_id] = { type: "Default", loc: `${switchCase.loc.start.line}-${switchCase.loc.end.line}` };
            edges.push({ edge: [discriminant_node_id, switch_case_id] });
        }
        
        consequent.forEach((statement) => {
            const statement_id = getNextNodeId(); 
            nodes[statement_id] = { type: statement.type, loc: `${statement.loc.start.line}-${statement.loc.end.line}` };
            edges.push({ edge: [this.node_id-2, statement_id] });
        });
        
        const last_statement = this.node_id-1;
        if (nodes[last_statement].type == "BreakStatement") {
            edges.push({ edge: [last_statement, exit_node_id] });
        } else if (switch_cases_visited + 1 == number_switch_cases) {
            edges.push({ edge: [last_statement, exit_node_id] });
        } else {
            edges.push({ edge: [last_statement, this.node_id] });
        }
        
        switch_cases_visited++;
    });
    
    return {
        data: [{ entry_node_id, exit_node_id, nodes, edges }],
    };
}

function buildReturn(obj) {
    const { argument }  = obj;
    
    const nodes = {};
    const edges = [];

    const entry_node_id       = getNextNodeId();
    const exit_node_id        = getNextNodeId();
    const argument_node_id    = getNextNodeId();
    
    nodes[entry_node_id]      = { type: "_root", loc: null };
    nodes[argument_node_id]   = { type: argument.type, loc: `${argument.loc.start.line}-${argument.loc.end.line}` };
    nodes[exit_node_id]       = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, argument_node_id], label: "return"});
    edges.push({ edge: [argument_node_id, exit_node_id] });
    
    return {
        data: [{ entry_node_id, exit_node_id, nodes, edges }],
    };
}

const createNode = (obj, node_id, label) => ({
    id: node_id,
    type: obj.type,
    ...(label && { label: label }),
    ...(obj.loc && { loc: `${obj.loc.start.line}-${obj.loc.end.line}` }),
});

const sequenceChildren = (children, nodes, edges) => {
    let first_root = children.length > 0 ? children[0].root : null;
    if (!first_root) return {};
    let previous_exit = children[0].exit;
    
    children.forEach((child) => {
        let _r = child.root;
        let _e = child.exit;

        nodes = [...nodes, ...child.nodes];
        edges = [...edges, ...child.edges];

        if (previous_exit != _e) {
            edges.push([previous_exit, _r]);
            previous_exit = _e;
        }
    });

    return {
        root: first_root,
        nodes,
        edges,
        exit: previous_exit,
    };
};

const defaultNode = (obj) => {
    const df_node_id = getNextNodeId();
    const df_node = createNode(obj, df_node_id);

    return {
        root: df_node_id,
        nodes: [ df_node ],
        edges: [],
        exit: df_node_id,
    };
};

const buildProgram = (obj, children) => {
    const start_node_id = getNextNodeId();
    const start_node = createNode({ type: "_start" }, start_node_id);
    
    const end_node_id = getNextNodeId();
    const end_node = createNode({ type: "_end" }, end_node_id);
    
    let { root, nodes, edges, exit } = sequenceChildren(children, [start_node, end_node], []);

    edges.push([start_node_id, root]);
    edges.push([exit, end_node_id]);
    
    return {
        root: start_node_id,
        nodes,
        edges,
        exit: end_node_id,
    };
};

const buildFunctionDeclaration = (obj, children) => {
    const func_node_id = getNextNodeId();
    const func_node = obj.id ? createNode(obj, func_node_id, obj.id.name) : createNode(obj, func_node_id);
    
    const block_subgraph = children[0];
    
    let edges = [...block_subgraph.edges];
    edges.push([func_node_id, block_subgraph.root]);
    edges.push([block_subgraph.exit, func_node_id]);

    return {
        root: func_node_id,
        nodes: [ func_node, ...block_subgraph.nodes ],
        edges: edges,
        exit: func_node_id,
    };
};

const buildBlockStatement = (obj, children) => {
    return sequenceChildren(children, [], []);
};

const buildVariableDeclarator = (obj, children) => {
    return children[1] ? children[1] : null;
};

const buildVariableDeclaration = (obj, children) => {
    const variable_name = obj.declarations[0].id.name;
    const var_node_id = getNextNodeId();
    const var_node = createNode(obj, var_node_id, variable_name);
    
    let nodes = [ var_node ];
    let edges = [];

    if (children.length > 0) {
        nodes = [ ...nodes, ...children[0].nodes ];
        edges = children[0].edges;

        edges.push([var_node_id, children[0].root]);
        edges.push([children[0].exit, var_node_id]);
    }

    return {
        root: var_node_id,
        nodes,
        edges,
        exit: var_node_id,
    };
};

const buildIfStatement = (obj, children) => {
    const test = children[0];
    const consequent = children[1];
    const alternate = (children.length > 2) ? children[2] : null;

    const if_node_id = getNextNodeId();
    const if_node = createNode(obj, if_node_id);

    const end_node_id = getNextNodeId();
    const end_node = createNode({ type: "endif" }, end_node_id);

    let nodes = [if_node, end_node];
    let edges = [];

    edges.push([if_node_id, test.root, "if"]);
    edges.push([test.exit, consequent.root, "true"]);
    edges.push([consequent.exit, end_node_id]);

    if (alternate) {
        edges.push([test.exit, alternate.root, "false"]);
        edges.push([alternate.exit, end_node_id]);

        nodes = [...nodes, ...test.nodes, ...consequent.nodes, ...alternate.nodes];
        edges = [...edges, ...test.edges, ...consequent.edges, ...alternate.edges];
    } else {
        nodes = [...nodes, ...test.nodes, ...consequent.nodes];
        edges = [...edges, ...test.edges, ...consequent.edges];
    }

    return {
        root: if_node_id,
        nodes: nodes,
        edges: edges,
        exit: end_node_id,
    };
};

function cfg_builder(obj, children) {
    // if (!obj) {
    //     return {
    //         data: [],
    //     };
    // }
    
    switch (obj.type) {
        case "Program":
            return buildProgram(obj, children);

        case "FunctionDeclaration":
            return buildFunctionDeclaration(obj, children);

        case "BlockStatement":
            return buildBlockStatement(obj, children);

        case "VariableDeclaration":
            return buildVariableDeclaration(obj, children);

        case "VariableDeclarator":
            return buildVariableDeclarator(obj, children);

        case "IfStatement":
            return buildIfStatement(obj, children);

        // case "WhileStatement":
        //     return buildWhile(obj);

        // case "SwitchStatement":
        //     return buildSwitch(obj);

        // case "ReturnStatement":
        //     return buildReturn(obj);

        // case "CallExpression":
        //     return buildCall(obj);

        default:
            // console.log("Default ->", obj.type);
            return defaultNode(obj);
    }
}

module.exports = cfg_builder;
