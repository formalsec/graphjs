const yargs = require("yargs/yargs");
const fs = require("fs");
const esprima = require("esprima");
const escodegen = require("escodegen");
const { Graph } = require("./traverse/graph/graph");
const { normalize } = require("./traverse/normalizer");
const { buildAST } = require("./traverse/ast_builder");
const { buildCFG } = require("./traverse/cfg_builder");
const { buildPDG } = require("./traverse/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");

// Returns a graph object
function parse(file) {
    try {
        const data = fs.readFileSync(file, "utf8");
        const ast = esprima.parse(data, { loc: true });

        const normalizedAst = normalize(ast).stmts[0];
        // console.log(JSON.stringify(normalizedAst, null, 2));

        const code = escodegen.generate(normalizedAst);
        console.log(code);

        const astGraph = buildAST(normalizedAst);
        const cfgGraph = buildCFG(astGraph);

        const pdgGraph = buildPDG(cfgGraph);

        return pdgGraph;
    } catch (e) {
        console.log("Error:", e.stack);
    }

    return new Graph();
}

const { argv } = yargs(process.argv.slice(3))
    .boolean("csv")
    .array("ignore")
    .boolean("show_code");

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const graphOptions = {
        ignore: argv.ignore || [],
        show_code: argv.show_code || false,
    };

    const graph = parse(filename);

    if (graph) {
        if (argv.csv) {
            graph.outputManager = new OutputManager(graphOptions, new CSVOutput());
        } else {
            graph.outputManager = new OutputManager(graphOptions, new DotOutput());
        }

        graph.output("graph");
    }
} else {
    console.error(`${filename} is not a valid file.`);
}
