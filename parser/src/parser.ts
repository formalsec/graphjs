import yargs = require("yargs/yargs");
import fs = require("fs");
import path = require("path");
import esprima = require("esprima");
import escodegen from "escodegen";
import { normalizeScript } from "./traverse/normalizer";
import buildAST from "./traverse/ast_builder";
const { buildTypes } = require("./traverse/type_builder");
const { buildCFG } = require("./traverse/cfg_builder");
const { buildCallGraph } = require("./traverse/cg_builder");
const { buildPDG, PDGReturn } = require("./traverse/dependency/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");

// eslint-disable-next-line no-unused-vars
import { printJSON } from "./utils/utils";
import { read_config, Config } from "./utils/config_reader";
import { Graph } from "./traverse/graph/graph";
import { PDGReturn } from "./traverse/dependency/dep_builder";

// Returns a graph object
function parse(filename: string, config: Config, file_output: boolean) : Graph {
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
        const callGraphReturn = buildCallGraph(cfgGraph, config);
        const callGraph = callGraphReturn.callGraph;
        config = callGraphReturn.config;
        const pdgReturn: PDGReturn = buildPDG(callGraph, config);
        const pdgGraph = pdgReturn.graph;
        const trackers = pdgReturn.trackers;
        const finalGraph = buildTypes(pdgGraph, trackers);
        return finalGraph;
    } catch (e: any) {
        console.log("Error:", e.stack);
    }

    return new Graph(null);
}

const { argv } = yargs(process.argv.slice(2))
    .usage('Usage: $0 <command> [options]')
    .alias('f', 'file')
    .nargs('f', 1)
    .describe('f', 'Load a JavaScript file')
    .string('file')
    .alias('c', 'config')
    .nargs('c', 1)
    .describe('c', 'Load a config file')
    .demandOption(['f', 'c'])
    .string('config')
    .example('$0 -f ./foo.js -c ./config.json', 'process the foo.js file using the config.json options')
    .boolean('out')
    .describe('out', 'Output the normalized file')
    .boolean('graph')
    .describe('graph', 'Output the graph figure')
    .boolean('csv')
    .describe('csv', 'Output the graph csv file')
    .array('i')
    .alias('i', 'ignore')
    .describe('i', 'Set array of structures to ignore in graph figure')
    .example('$0 -f ./foo.js -c ./config.json -i="AST"', 'process the foo.js file using the config.json options')
    .array('if')
    .alias('if', 'ignore_func')
    .describe('if', 'Set array of structures to ignore in graph figure')
    .example('$0 -f ./foo.js -c ./config.json -if="__main__"', 'process the foo.js file using the config.json options')
    .boolean('sc')
    .alias('sc', 'show_code')
    .describe('sc', 'Show the code in each instruction in graph figure')
    .help('h')
    .alias('h', 'help');

const filename = <string> argv.file;
const configFile = <string> argv.config;
if (fs.existsSync(filename)) {
    const graphOptions = {
        ignore: argv.i || [],
        ignore_func: argv.if || [],
        show_code: argv.sc || false,
    };

    let file_output = false;
    if (argv.out) {
        file_output = argv.out;
    }

    if (fs.existsSync(configFile)) {
        const config = read_config(configFile);
        const graph = parse(filename, config, file_output);

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
        console.error(`${configFile} is not a valid config file.`);
    }
} else {
    console.error(`${filename} is not a valid file.`);
}