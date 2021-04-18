const fs        = require('fs');
const esprima   = require('esprima');
const escodegen = require('escodegen');
// const mapper    = require('./mapper');
const traverse  = require('./traverse/traverse');
const cfg_builder = require('./traverse/cfgraph');
const { normalize } = require('./traverse/normalizer');
const outputGraph = require('./graph_visualizer');
// const { printDebug } = require('./utils');


function parse(file) {
    try {
        const data  = fs.readFileSync(file, 'utf8');
        const ast   = esprima.parse(data, { loc: true });

        const normalized_ast = traverse(normalize, ast);
        const normalized_stmts = normalized_ast.stmts[0];

        const code = escodegen.generate(normalized_stmts);
        console.log(code);
        // console.log(JSON.stringify(normalized_stmts, null, 2));

        // Build Control-Flow Graph
        return traverse(cfg_builder, normalized_stmts);
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const result = parse(filename);
    // console.log(JSON.stringify(result, null, 2));
    outputGraph(result);

} else {
    console.error(`${filename} is not a valid file.`);
}