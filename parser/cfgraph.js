
let { NODE_COUNT, printDebug } = require('./utils');

function buildIf(obj) {
    const { test, consequent, alternate}  = obj;
    
    const nodes = {};
    const edges = [];
    
    const entry_node_id   = this.node_id++;
    const exit_node_id    = this.node_id++;

    const test_node_id        = this.node_id++;
    const consequent_node_id  = this.node_id++;
    const alternate_node_id   = this.node_id++;
    
    nodes[entry_node_id]      = { type: "_root", loc: null };
    nodes[test_node_id]       = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
    nodes[consequent_node_id] = { type: consequent.type, loc: `${consequent.loc.start.line}-${consequent.loc.end.line}` };
    nodes[alternate_node_id]  = { type: alternate.type, loc: `${alternate.loc.start.line}-${alternate.loc.end.line}` };
    nodes[exit_node_id]       = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, test_node_id], label: "if"});
    edges.push({ edge: [test_node_id, consequent_node_id], label: "true" });
    edges.push({ edge: [test_node_id, alternate_node_id], label: "false" });
    edges.push({ edge: [consequent_node_id, exit_node_id] });
    edges.push({ edge: [alternate_node_id, exit_node_id] });
    
    return {
        data: [{ entry_node_id, exit_node_id, nodes, edges }],
    };
}

function buildWhile(obj) {
    const { test, body}  = obj;
    
    const nodes = {};
    const edges = [];

    const entry_node_id   = this.node_id++;
    const exit_node_id    = this.node_id++;

    const test_node_id    = this.node_id++;
    const body_node_id    = this.node_id++;
    
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

    const entry_node_id   = this.node_id++;
    const exit_node_id    = this.node_id++;
    
    const discriminant_node_id = this.node_id++;

    nodes[entry_node_id]          = { type: "_root", loc: null };
    nodes[discriminant_node_id]   = { type: discriminant.type, loc: `${discriminant.loc.start.line}-${discriminant.loc.end.line}` };
    nodes[exit_node_id]           = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, discriminant_node_id], label: "switch"});
    
    let switch_cases_visited = 0;
    const number_switch_cases = cases.length;
    
    cases.forEach((switchCase) => {
        const { test, consequent } = switchCase;
        const switch_case_id = this.node_id++;
        
        if (test) {
            nodes[switch_case_id] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
            edges.push({ edge: [discriminant_node_id, switch_case_id], label: test.value.toString() });
        } else {
            nodes[switch_case_id] = { type: "Default", loc: `${switchCase.loc.start.line}-${switchCase.loc.end.line}` };
            edges.push({ edge: [discriminant_node_id, switch_case_id] });
        }
        
        consequent.forEach((statement) => {
            const statement_id = this.node_id++; 
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

    const entry_node_id       = this.node_id++;
    const exit_node_id        = this.node_id++;
    const argument_node_id    = this.node_id++;
    
    nodes[entry_node_id]      = { type: "_root", loc: null };
    nodes[argument_node_id]   = { type: argument.type, loc: `${argument.loc.start.line}-${argument.loc.end.line}` };
    nodes[exit_node_id]       = { type: "_end", loc: null };
    
    edges.push({ edge: [entry_node_id, argument_node_id], label: "return"});
    edges.push({ edge: [argument_node_id, exit_node_id] });
    
    return {
        data: [{ entry_node_id, exit_node_id, nodes, edges }],
    };
}

// function buildCall(obj) {
//     const { callee } = obj;

//     const nodes = {};
//     const edges = [];

//     const entry_node_id   = this.node_id++;
//     const exit_node_id    = this.node_id++;
//     const calleeId      = this.node_id++;

//     nodes[entry_node_id] = { type: "_root", loc: null };
//     nodes[calleeId] = { type: `${obj.type} ${callee.name}`, loc: `${callee.loc.start.line}-${callee.loc.end.line}` };
//     nodes[exit_node_id] = { type: "_end", loc: null };
    
//     edges.push({ edge: [entry_node_id, calleeId], label: "call"});
//     edges.push({ edge: [calleeId, exit_node_id] });
    
//     return {
//         data: [{ entry_node_id, exit_node_id, nodes, edges }],
//     };
// }

function cfg_builder(obj) {
    if (!obj) {
        return {
            data: [],
        };
    }
    
    switch (obj.type) {
        case "IfStatement":
            return buildIf(obj);

        case "WhileStatement":
            return buildWhile(obj);

        case "SwitchStatement":
            return buildSwitch(obj);

        case "ReturnStatement":
            return buildReturn(obj);

        // case "CallExpression":
        //     return buildCall(obj);

        default:
            console.log("Default ->", obj.type);
            return {
                data: [],
            };
    }
}

module.exports = cfg_builder;
