const fs        = require('fs');
const esprima   = require('esprima');
const mapper    = require('./mapper');
const graphviz  = require('graphviz');

const graphFunctions = {
    let node_id = 0;
    build_if: (obj) => {
        const { test, consequent, alternate}  = obj;

        const nodes = {};
        const edges = [];

        //let node_id = 0
        nodes[node_id++] = { type: "_root", loc: null };
        nodes[node_id++] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
        nodes[node_id++] = { type: consequent.type, loc: `${consequent.loc.start.line}-${consequent.loc.end.line}` };
        nodes[node_id++] = { type: alternate.type, loc: `${alternate.loc.start.line}-${alternate.loc.end.line}` };
        nodes[node_id++] = { type: "_end", loc: null };

        edges.push({ edge: [0, 1], label: "if"});
        edges.push({ edge: [1, 2], label: "true" });
        edges.push({ edge: [1, 3], label: "false" });
        edges.push({ edge: [2, 4] });
        edges.push({ edge: [3, 4] });
        return { nodes, edges };
    },

    build_while: (obj) => {
        const { test, body}  = obj;

        const nodes = {};
        const edges = [];

        let node_id = 0
        nodes[node_id++] = { type: "_root", loc: null };
        nodes[node_id++] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
        nodes[node_id++] = { type: body.type, loc: `${body.loc.start.line}-${body.loc.end.line}` };
        nodes[node_id++] = { type: "_end", loc: null };

        edges.push({ edge: [0, 1], label: "while"});
        edges.push({ edge: [1, 2], label: "true" });
        edges.push({ edge: [2, 1] });
        edges.push({ edge: [1, 3] });
        return { nodes, edges };
    },

    build_switch: (obj) => {
        const { discriminant, cases }  = obj;

        const nodes = {};
        const edges = [];

        let node_id = 0
        nodes[node_id++] = { type: "_root", loc: null };
        nodes[node_id++] = { type: discriminant.type, loc: `${discriminant.loc.start.line}-${discriminant.loc.end.line}` };
        edges.push({ edge: [0, 1], label: "switch"});
        
        nodes[node_id++] = { type: "_end", loc: null };

        let switchCasesVisited = 0;
        const numberSwitchCases = cases.length;

        cases.forEach((switchCase) => {
            const { test, consequent } = switchCase;
            const switchCaseId = node_id++;

            if (test) {
                nodes[switchCaseId] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
                edges.push({ edge: [1, switchCaseId], label: test.value.toString() });
            } else {
                nodes[switchCaseId] = { type: "Default", loc: `${switchCase.loc.start.line}-${switchCase.loc.end.line}` };
                edges.push({ edge: [1, switchCaseId] });
            }
            
            consequent.forEach((statement) => {
                const statementId = node_id++; 
                nodes[statementId] = { type: statement.type, loc: `${statement.loc.start.line}-${statement.loc.end.line}` };
                edges.push({ edge: [node_id-2, statementId] });
            });

            const lastStatement = node_id-1;
            if (nodes[lastStatement].type == "BreakStatement") {
                edges.push({ edge: [lastStatement, 2] });
            } else if (switchCasesVisited + 1 == numberSwitchCases) {
                edges.push({ edge: [lastStatement, 2] });
            } else {
                edges.push({ edge: [lastStatement, node_id] });
            }

            switchCasesVisited++;
        });

        return { nodes, edges };
    },

    build_return: (obj) => {
        const { argument }  = obj;

        const nodes = {};
        const edges = [];

        let node_id = 0
        nodes[node_id++] = { type: "_root", loc: null };
        nodes[node_id++] = { type: argument.type, loc: `${argument.loc.start.line}-${argument.loc.end.line}` };
        nodes[node_id++] = { type: "_end", loc: null };

        edges.push({ edge: [0, 1], label: "return"});
        edges.push({ edge: [1, 2] });
        return { nodes, edges };
    }
}

function parse(file) {
    try {
        const data  = fs.readFileSync(process.argv[2], 'utf8');
        const ast   = esprima.parse(data, { loc: true });
        // console.log(JSON.stringify(ast, null, 2));
    
        // console.log("==================");

        const graphs = [];

        const traverse = (obj) => {
            
            switch (obj.type) {
                case "IfStatement":
                    graphs.push(graphFunctions.build_if(obj));
                    break;
                
                case "WhileStatement":
                    graphs.push(graphFunctions.build_while(obj));
                    break;

                case "SwitchStatement":
                    graphs.push(graphFunctions.build_switch(obj));
                    break;
                
                case "ReturnStatement":
                    graphs.push(graphFunctions.build_return(obj));
                    break;
            }

            return { obj: obj, recurse: true };
        };

        mapper(traverse, ast);
        return graphs;
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

function output_graphs(graphs) {
    graphs.forEach((g) => {
        const { nodes, edges } = g;
        const dotNodes = {}; 

        const gDot = graphviz.digraph("G");

        for (let i = 0; i < Object.keys(nodes).length; i++) {
            const index = i.toString();
            const nName = nodes[index].loc ? `${nodes[index].type} (${nodes[index].loc})` : `${nodes[index].type}`;
            dotNodes[i] = gDot.addNode(nName);
        }

        edges.forEach((e)=>{
            const start = e.edge[0];
            const end   = e.edge[1];

            if (e.label) {
                gDot.addEdge(dotNodes[start], dotNodes[end], { label: e.label });
            } else {
                gDot.addEdge(dotNodes[start], dotNodes[end]);
            }            
        });

        console.log(gDot.to_dot());
        gDot.output("png", "test01.png");
    });
}

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const result = parse(filename);
    output_graphs(result);

} else {
    console.error(`${filename} is not a valid file.`);
}

function getFuncDeclrs(obj) {
    function callback(obj) {
        if (!obj) {
            return {
                stop: true,
                data: [],
            };
        }
        switch (obj.type) {
            case "FunctionDeclaration":
                return {
                    stop: true,
                    data: [obj],
                };
            case "FunctionExpression":
                return {
                    stop: true,
                    data: [],
                };
            default:
                return {
                    stop: false,
                    data: [],
                };
        }
    }
    return traverse(callback, obj).data;
}

/*
e1 + e2 + e3 
x1 = e1 + e2 
x2 = x3 + e3 
*/
  