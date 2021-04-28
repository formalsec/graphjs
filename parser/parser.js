const yargs = require('yargs/yargs');
const fs        = require('fs');
const esprima   = require('esprima');
const escodegen = require('escodegen');
// const mapper    = require('./mapper');
const traverse  = require('./traverse/traverse');
const { normalize } = require('./traverse/normalizer');
const { ast_builder } = require('./traverse/ast_builder');
const { cfg_builder } = require('./traverse/cfg_builder');
// const { printDebug } = require('./utils');
const { OutputManager, DotOutput } = require('./output/output_strategy');

// Returns a graph object
function parse(file, graph_options) {
    try {
        const data  = fs.readFileSync(file, 'utf8');
        const ast   = esprima.parse(data);//, { loc: true });

        const normalized_ast = traverse(normalize, ast).stmts[0];
        // console.log(JSON.stringify(normalized_ast, null, 2));
        
        const code = escodegen.generate(normalized_ast);
        console.log(code);
        
        const ast_functions = ast_builder();
        traverse(ast_functions.visit, normalized_ast);
        let graph = ast_functions.graph();

        const cfg_functions = cfg_builder(graph);
        traverse(cfg_functions.visit, normalized_ast);
        graph = cfg_functions.graph();

        return graph;
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

const argv = yargs(process.argv.slice(3))
    .array('ignore')
    .argv;
const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const graph_options = {
        ignore: argv.ignore || [],
    };

    const graph = parse(filename, graph_options);
    const output_manager = new OutputManager(graph_options);
    output_manager.writer = new DotOutput();
    graph.output_manager = output_manager;
    graph.output('graph');
} else {
    console.error(`${filename} is not a valid file.`);
}