import yargs = require("yargs/yargs");
import fs = require("fs");
import path = require("path");
import esprima = require("esprima");
import escodegen from "escodegen";
import { normalizeScript } from "./traverse/normalizer";
const { buildAST } = require("./traverse/ast_builder");
const { buildCFG } = require("./traverse/cfg_builder");
const { buildCallGraph } = require("./traverse/cg_builder");
const { buildPDG } = require("./traverse/dependency/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");

// eslint-disable-next-line no-unused-vars
import { printJSON } from "./utils/utils";
import { Graph } from "./traverse/graph/graph";

// Returns a graph object
function parse(filename: string, file_output: boolean) : Graph {
    try {
        const data = fs.readFileSync(filename, "utf8");
        const ast = esprima.parseModule(data, {tolerant: true});
        // const ast = esprima.parseScript(data, { loc: true });

        // // printJSON(ast);
        // // console.log("===============");
        let normalizedAst = normalizeScript(ast);
        // // printJSON(normalizedAst);
        // // console.log("===============");

        const code = escodegen.generate(normalizedAst);
        // const code = escodegen.generate(ast);
        console.log(code);

        const normalizedFilename = path.basename(filename).slice(0, -path.extname(filename).length) + "-normalized";
        const normalizedFilepath = path.join(path.dirname(filename), normalizedFilename + path.extname(filename));

        if (file_output) {
            fs.writeFileSync(normalizedFilepath, code);
            console.log("===============");
        }

        // just to get the loc of the normalized version
        normalizedAst = esprima.parseModule(code, { loc: true, tolerant: true});
        const astGraph = buildAST(normalizedAst);
        const cfgGraph = buildCFG(astGraph);
        const callGraph = buildCallGraph(cfgGraph);
        const pdgGraph = buildPDG(callGraph);
        return pdgGraph;
    } catch (e: any) {
        console.log("Error:", e.stack);
    }

    return new Graph(null);
}

const { argv } = yargs(process.argv.slice(3))
    .boolean("file")
    .boolean("graph")
    .boolean("csv")
    .array("ignore")
    .boolean("show_code");

const filename = process.argv[2];
if (fs.existsSync(filename)) {
    const graphOptions = {
        ignore: argv.ignore || [],
        show_code: argv.show_code || false,
    };

    let file_output = false;
    if (argv.file) {
        file_output = argv.file;
    }

    const graph = parse(filename, file_output);

    if (graph) {
        if (argv.csv) {
            graph.outputManager = new OutputManager(graphOptions, new CSVOutput());
            graph.output("src/graphs/graph");
        }

        if (argv.graph) {
            graph.outputManager = new OutputManager(graphOptions, new DotOutput());
            graph.output("src/graphs/graph");
        }
    }
} else {
    console.error(`${filename} is not a valid file.`);
}
