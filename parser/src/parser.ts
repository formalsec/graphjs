import yargs = require("yargs/yargs");
import fs = require("fs");
import path = require("path");
import esprima = require("esprima");
import escodegen from "escodegen";
import { normalizeScript } from "./traverse/normalizer";
const { buildAST } = require("./traverse/ast_builder");
const { buildCFG } = require("./traverse/cfg_builder");
const { buildPDG } = require("./traverse/dependency/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");

// eslint-disable-next-line no-unused-vars
import { printJSON } from "./utils/utils";
import { Graph } from "./traverse/graph/graph";

// Returns a graph object
function parse(filename: string) : Graph {
    try {
        const data = fs.readFileSync(filename, "utf8");
        const ast = esprima.parseScript(data);
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
        // console.log(normalizedFilepath);
        fs.writeFileSync(normalizedFilepath, code);
        console.log("===============");

        normalizedAst = esprima.parseScript(code, { loc: true });
        const astGraph = buildAST(normalizedAst);
        // const astGraph = buildAST(ast);
        const cfgGraph = buildCFG(astGraph);
        // return cfgGraph;

        const pdgGraph = buildPDG(cfgGraph);
        return pdgGraph;
    } catch (e: any) {
        console.log("Error:", e.stack);
    }

    return new Graph(null);
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

        graph.output("src/graphs/graph");
    }
} else {
    console.error(`${filename} is not a valid file.`);
}
