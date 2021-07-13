const yargs = require('yargs/yargs');
const fs        = require('fs');
const esprima   = require('esprima');
const escodegen = require('escodegen');
const { normalize } = require('./traverse/normalizer');
const { buildAST } = require('./traverse/ast_builder');
const { buildCFG } = require('./traverse/cfg_builder');
const { buildPDG } = require('./traverse/dep_builder');
// const { printDebug } = require('./utils');
const { OutputManager, DotOutput } = require('./output/output_strategy');

// Returns a graph object
function parse(file, graph_options) {
    try {
        const data  = fs.readFileSync(file, 'utf8');
        const ast   = esprima.parse(data);//, { loc: true });

        const normalized_ast = normalize(ast).stmts[0];
        // console.log(JSON.stringify(normalized_ast, null, 2));
        
        const code = escodegen.generate(normalized_ast);
        console.log(code);

        const ast_graph = buildAST(normalized_ast);
        // console.log(ast_graph);
        
        const cfg_graph = buildCFG(ast_graph);
        // const cfg_functions = cfg_builder(graph);
        // traverse(cfg_functions.visit, normalized_ast);
        // graph = cfg_functions.graph();

        const pdg_graph = buildPDG(cfg_graph);

        return cfg_graph;
    } catch(e) {
        console.log('Error:', e.stack);
    }
}

const argv = yargs(process.argv.slice(3))
    .array('ignore')
    .boolean('show_code')
    .argv;

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const graph_options = {
        ignore: argv.ignore || [],
        show_code: argv.show_code || false,
    };

    const graph = parse(filename, graph_options);
    // console.log(graph);
    const output_manager = new OutputManager(graph_options);
    output_manager.writer = new DotOutput();
    graph.output_manager = output_manager;
    graph.output('graph');
} else {
    console.error(`${filename} is not a valid file.`);
}