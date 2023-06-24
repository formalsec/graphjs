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
const { buildPDG } = require("./traverse/dependency/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");
import { type CFGraphReturn } from "./traverse/cfg_builder";

import { printStatus } from "./utils/utils";
import { readConfig, type Config } from "./utils/config_reader";
import { Graph } from "./traverse/graph/graph";
import { type PDGReturn } from "./traverse/dependency/dep_builder";

// Returns a graph object
function parse(filename: string, config: Config, fileOutput: string): Graph {
    try {
        let data = fs.readFileSync(filename, "utf8");
        // Remove shebang line
        if (data.slice(0, 2) === "#!") {
            data = data.slice(data.indexOf('\n') + ('\n').length);
        }
        const ast = esprima.parseModule(data, { tolerant: true });
        printStatus("AST Parsing");

        let normalizedAst = normalizeScript(ast);
        printStatus("AST Normalization");

        const code = escodegen.generate(normalizedAst);
        console.log(`\nNormalized code:\n${code}\n`);

        if (fileOutput) {
            fs.writeFileSync(fileOutput, code);
            console.log("===============");
        }

        // just to get the loc of the normalized version
        normalizedAst = esprima.parseModule(code, { loc: true, tolerant: true });
        const astGraph = buildAST(normalizedAst);
        printStatus("Build AST");
        const cfGraphReturn: CFGraphReturn = buildCFG(astGraph);
        printStatus("Build CFG");
        const callGraphReturn = buildCallGraph(cfGraphReturn.graph, cfGraphReturn.functionContexts, config);
        printStatus("Build CG");
        const callGraph = callGraphReturn.callGraph;
        config = callGraphReturn.config;
        const pdgReturn: PDGReturn = buildPDG(callGraph, cfGraphReturn.functionContexts, config);
        printStatus("Build PDG");
        const pdgGraph = pdgReturn.graph;
        const trackers = pdgReturn.trackers;
        // const finalGraph = buildTypes(pdgGraph, trackers);
        // printStatus("Build Types")
        trackers.print();
        return pdgGraph;
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
    .example('$0 -f ./foo.js -c ../config.json', 'process the foo.js file using the config.json options')
    .option('o', {
        alias: 'output',
        type: 'string',
        description: 'Specify the normalized filepath',
    })
    .option('g', {
        alias: 'graph_dir',
        type: 'string',
        description: 'Specify the graph output directory',
    })
    .boolean('graph')
    .describe('graph', 'Output the graph figure')
    .boolean('csv')
    .describe('csv', 'Output the graph csv file')
    .array('i')
    .alias('i', 'ignore')
    .describe('i', 'Set array of structures to ignore in graph figure')
    .example('$0 -f ./foo.js -c ../config.json -i="AST"', 'process the foo.js file using the config.json options')
    .array('if')
    .alias('if', 'ignore_func')
    .describe('if', 'Set array of structures to ignore in graph figure')
    .example('$0 -f ./foo.js -c ../config.json -if="__main__"', 'process the foo.js file using the config.json options')
    .boolean('sc')
    .alias('sc', 'show_code')
    .describe('sc', 'Show the code in each instruction in graph figure')
    .help('h')
    .alias('h', 'help');

const filename = argv.file as string;
const configFile = argv.config as string;
if (fs.existsSync(filename)) {
    const graphOptions = {
        ignore: argv.i ?? [],
        ignore_func: argv.if ?? [],
        show_code: argv.sc ?? false
    };

    let fileOutput = "";
    if (argv.o) {
        fileOutput = argv.o;
    }

    if (fs.existsSync(configFile)) {
        const config = readConfig(configFile);
        const graph = parse(filename, config, fileOutput);

        if (graph) {
            if (argv.csv) {
                graph.outputManager = new OutputManager(graphOptions, new CSVOutput());
                graph.output("src/graphs/");
                if (argv.g) {
                    graph.output(argv.g);
                }
            }

            if (argv.graph) {
                graph.outputManager = new OutputManager(graphOptions, new DotOutput());
                graph.output("src/graphs/");
                if (argv.g) {
                    graph.output(argv.g);
                }
            }
        }
    } else {
        console.error(`${configFile} is not a valid config file.`);
    }
} else {
    console.error(`${filename} is not a valid file.`);
}
