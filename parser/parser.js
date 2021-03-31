const fs        = require('fs');
const esprima   = require('esprima');
const escodegen = require('escodegen');
const mapper    = require('./mapper');
const traverse  = require('./traverse');
const GraphBuilder = require('./graph_builder');
const normalize = require('./normalizer');
const outputGraph = require('./graph_visualizer');


function parse(file) {
    try {
        const data  = fs.readFileSync(process.argv[2], 'utf8');
        const ast   = esprima.parse(data);//, { loc: true });

        // console.log(JSON.stringify(ast, null, 2));
        // console.log("==================");

        // Normalize JavaScript
        // function mapperCallback(obj) {
        //     return { obj: obj, recurse: true };
        // }

        // const normalized_ast = mapper(mapperCallback, ast);
        const normalized_ast = traverse(normalize, ast);

        // console.log(JSON.stringify(normalized_ast.stmts[0], null, 2));
        // console.log("==================");

        const code = escodegen.generate(normalized_ast.stmts[0]);
        console.log(code);

        return;

        // console.log(JSON.stringify(normalized_ast, null, 2));
        // console.log("==================");

        // Build Control-Flow Graph
        const g_builder = new GraphBuilder();

        function traverseCallback(obj) {
            if (!obj) {
                return {
                    data: [],
                };
            }
            
            switch (obj.type) {
                case "IfStatement":
                    return {
                        data: [g_builder.buildIf(obj)],
                    };

                case "WhileStatement":
                    return {
                        data: [g_builder.buildWhile(obj)],
                    };

                case "SwitchStatement":
                    return {
                        data: [g_builder.buildSwitch(obj)],
                    };

                case "ReturnStatement":
                    return {
                        data: [g_builder.buildReturn(obj)],
                    };

                // case "CallExpression":
                //     return {
                //         data: [g_builder.buildCall(obj)],
                //     };

                default:
                    return {
                        data: [],
                    };
            }
        }

        return traverse(traverseCallback, normalized_ast).data;
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const result = parse(filename);
    // console.log(JSON.stringify(result, null, 2));
    // outputGraph(result);

} else {
    console.error(`${filename} is not a valid file.`);
}

/*
e1 + e2 + e3 
x1 = e1 + e2 
x2 = x3 + e3 
*/
  