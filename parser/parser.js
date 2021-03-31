const fs        = require('fs');
const graphviz  = require('graphviz');
const esprima   = require('esprima');
const mapper    = require('./mapper');
const traverse  = require('./traverse');
const GraphBuilder = require('./graph_builder');

function parse(file) {
    try {
        const data  = fs.readFileSync(process.argv[2], 'utf8');
        const ast   = esprima.parse(data, { loc: true });

        // console.log(JSON.stringify(ast, null, 2));
        // console.log("==================");

        // Normalize JavaScript
        function mapper_callback(obj) {
            return { obj: obj, recurse: true };
        }

        const normalized_ast = mapper(mapper_callback, ast);
        // console.log(JSON.stringify(normalized_ast, null, 2));
        // console.log("==================");

        const gBuilder = new GraphBuilder();

        function traverse_callback(obj) {
            if (!obj) {
                return {
                    data: [],
                };
            }
            
            switch (obj.type) {
                case "IfStatement":
                    return {
                        data: [gBuilder.build_if(obj)],
                    };

                case "WhileStatement":
                    return {
                        data: [gBuilder.build_while(obj)],
                    };

                case "SwitchStatement":
                    return {
                        data: [gBuilder.build_switch(obj)],
                    };

                case "ReturnStatement":
                    return {
                        data: [gBuilder.build_return(obj)],
                    };

                // case "CallExpression":
                //     return {
                //         data: [gBuilder.build_call(obj)],
                //     };

                default:
                    return {
                        data: [],
                    };
            }
        }

        return traverse(traverse_callback, normalized_ast).data;
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

function output_graphs(graphs) {
    graphs.forEach((g) => {
        const { nodes, edges } = g;
        const dotNodes = {}; 

        const gDot = graphviz.digraph("G");

        Object.keys(nodes).forEach((nodeId) => {
            const nName = nodes[nodeId].loc ? `${nodes[nodeId].type} (${nodes[nodeId].loc})` : `${nodes[nodeId].type}`;
            dotNodes[nodeId] = gDot.addNode(nName);
        });

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
    // console.log(JSON.stringify(result, null, 2));
    output_graphs(result);

} else {
    console.error(`${filename} is not a valid file.`);
}

/*
e1 + e2 + e3 
x1 = e1 + e2 
x2 = x3 + e3 
*/
  