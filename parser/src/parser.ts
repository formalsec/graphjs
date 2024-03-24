import yargs = require("yargs/yargs");
import fs = require("fs");
import path = require("path");
import esprima = require("esprima");
import escodegen from "escodegen";
import dependencyTree = require("dependency-tree");
import { normalizeScript } from "./traverse/normalization/normalizer";
import buildAST from "./traverse/ast_builder";
const { buildCFG } = require("./traverse/cfg_builder");
const { buildCallGraph } = require("./traverse/cg_builder");
const { buildPDG } = require("./traverse/dependency/dep_builder");
const { OutputManager } = require("./output/output_strategy");
const { DotOutput } = require("./output/dot_output");
const { CSVOutput } = require("./output/csv_output");

import { type CFGraphReturn } from "./traverse/cfg_builder";

import { printStatus} from "./utils/utils";
import {constructExportedObject,findCorrespodingFile,printDependencyGraph,retrieveFunctionGraph} from "./utils/multifile";
import { getFunctionName } from "./traverse/dependency/utils/nodes";
import { readConfig, type Config } from "./utils/config_reader";
import { Graph } from "./traverse/graph/graph";
import { type PDGReturn } from "./traverse/dependency/dep_builder";
import { GraphNode } from "./traverse/graph/node";
import { GraphEdge } from "./traverse/graph/edge";
import { DependencyTracker } from "./traverse/dependency/structures/dependency_trackers";


// Generate the program graph (AST + CFG + CG + PDG)
function parse(filename: string, config: Config, fileOutput: string, silentMode: boolean,nodeCounter:number,
    edgeCounter:number): [Graph,DependencyTracker] {
    try {
        let fileContent = fs.readFileSync(filename, "utf8");
        // Remove shebang line
        if (fileContent.slice(0, 2) === "#!") fileContent = fileContent.slice(fileContent.indexOf('\n') + ('\n').length);

        // Parse AST
        const ast = esprima.parseModule(fileContent, { loc:true,tolerant: true });
        !silentMode && printStatus("AST Parsing");

        // Normalize AST
        let normalizedAst = normalizeScript(ast);
        !silentMode && printStatus("AST Normalization");

        // Generate the normalized code, to store it
        const code = escodegen.generate(normalizedAst);
        !silentMode && console.log(`\nNormalized code:\n${code}\n`);
        if (fileOutput) fs.writeFileSync(fileOutput, code);

        // Build AST graph
        const astGraph = buildAST(normalizedAst,nodeCounter,edgeCounter,filename);
        !silentMode && printStatus("Build AST");

        // Build Control Flow Graph (CFG)
        const cfGraphReturn: CFGraphReturn = buildCFG(astGraph);
        !silentMode && printStatus("Build CFG");

        // Build Call Graph (CG)
        const callGraphReturn = buildCallGraph(cfGraphReturn.graph, cfGraphReturn.functionContexts, config);
        !silentMode && printStatus("Build CG");
        const callGraph = callGraphReturn.callGraph;
        config = callGraphReturn.config;

        // Build Program Dependence Graph (PDG)
        const pdgReturn: PDGReturn = buildPDG(callGraph, cfGraphReturn.functionContexts, config);
        !silentMode && printStatus("Build PDG");
        const pdgGraph = pdgReturn.graph;
        const trackers = pdgReturn.trackers;

        // Print trackers
        !silentMode && trackers.print();
        
        // return the pdg graph and trackers
        return [pdgGraph,trackers];
    } catch (e: any) {
        console.log("Error:", e.stack);
    }

    return [new Graph(null),new DependencyTracker(new Graph(null),new Map<number, number[]>())];
}

// Traverse the dependency tree of the given file and generate the code property graph that accounts for all the dependencies
function traverseDependecyGraph(depGraph: any,config:Config,normalizedOutputDir:string,silentMode:boolean):Graph{

        function traverse(currFile:string,depGraph: any,config:Config,normalizedOutputDir:string,silentMode:boolean,
            exportedObjects:Map<string, Object>,nodeCounter:number, edgeCounter:number):[Graph,number,number,DependencyTracker] {

            let trackers:DependencyTracker;
            let cpg = new Graph(null);
            for(let [file,childDepGraph] of Object.entries(depGraph)){ // first parse its dependencies

                // skip empty dependencies or already parsed files
                if(exportedObjects.has(file)) continue;
                [cpg,nodeCounter,edgeCounter,trackers] = traverse(file,childDepGraph,config,normalizedOutputDir,silentMode,exportedObjects,nodeCounter,edgeCounter);
            }
                
            // parse the file and generate the exported Object
            [cpg,trackers] = parse(currFile,config,path.join(normalizedOutputDir,path.basename(currFile)),silentMode,
                nodeCounter,edgeCounter);
            nodeCounter = cpg.number_nodes;
            let exported = constructExportedObject(cpg,trackers);

            // add the exported objects to the map
            let dir = path.dirname(currFile);
            exportedObjects.set(currFile,exported);
            exportedObjects.set(currFile.slice(0,-3),exported); // remove the .js extension (it might be referenced without it)

            
            // add the exported functions to cpg to generate the final graph
            trackers.callNodesList.forEach((callNode:GraphNode)=> {

                const { calleeName, functionName } = getFunctionName(callNode);

                let [module,propertiesToTraverse] = findCorrespodingFile(calleeName,callNode.functionContext,trackers);
                propertiesToTraverse.push(functionName);

                if(module){ // external call
                    module = path.join(dir,module);
                    let exportedObj:any = exportedObjects.get(module);

                    if(exportedObj == undefined || Object.keys(exportedObj).length == 0) return;

                    let funcGraph:GraphNode|undefined = retrieveFunctionGraph(exportedObj,propertiesToTraverse);

                    if(funcGraph != undefined){

                        // add the exported function to the start nodes of the graph
                        cpg.addExternalFuncNode("function " + module + '.' + funcGraph.identifier,funcGraph); 
                        
                        
                        let params = funcGraph.edges.filter((e:GraphEdge) => e.label == "param").map((e:GraphEdge) => e.nodes[1]);

                        // connect object arguments to the parameters of the external function
                        callNode.argsObjIDs.forEach((arg:number,index:number) => {
                            
                            if(arg != -1){ // if the argument is a constant its value is -1 (thus literals aren't considred here)
                                
                                let label = "ARG(" + params[index+1].identifier + ')';
                                cpg.addEdge(arg,callNode.id,{type:"PDG",label:label});
                            
                            }   
                        });

                        cpg.addEdge(callNode.id, funcGraph.id, { type: "CG", label: "CG" })

                    }

                    
                }
                

                
                
            });

            edgeCounter = cpg.number_edges;

            return [cpg,nodeCounter,edgeCounter,trackers];

        }


    let cpg:Graph;
    let trackers:DependencyTracker;
    let nodeCounter:number, edgeCounter:number;
    [cpg,nodeCounter,edgeCounter,trackers] = traverse(Object.keys(depGraph)[0],depGraph,config,normalizedOutputDir,silentMode,new Map<string, Object>(),0,0);

    trackers.addTaintedNodes();
    
    return cpg;

}

// Parse program arguments
const { argv } = yargs(process.argv.slice(2))
    .usage('Usage: $0 <command> [options]')
    // JavaScript file to be analyzed
    .option('f', { alias: 'file', nargs: 1, desc: 'Load a JavaScript file', type: 'string', demandOption: true })
    // Location of the config file
    .option('c', { alias: 'config', nargs: 1, desc: 'Load a config file', type: 'string', default: '../../config.json' })
    // Location of the graph output directory (csv and svg files)
    .option('o', { alias: 'output', nargs: 1, desc: 'Specify the output directory', type: 'string', demandOption: true })
    // Select if graph figure should be generated (use arg --graph to generate)
    .option('graph', { desc: 'Output the graph figure', type: 'boolean' })
    // Select if csv files should be generated (use arg --csv to generate)
    .option('csv', { desc: 'Output the graph csv files', type: 'boolean' })
    // Select graph structures to not show in the final graph figure (use -i AST to ignore AST)
    .option('i', { alias: 'ignore', desc: 'Set array of structures to ignore in graph figure', type: 'array', implies: 'graph' })
    // Select functions to not show in the final graph figure
    .option('if', { alias: 'ignore_func', desc: 'Set array of functions to ignore in graph figure', type: 'array', implies: 'graph' })
    // Select if code should be displayed in each graph statement (otherwise AST values are shown)
    .option('sc', { alias: 'show_code', desc: 'Show the code in each statement in graph figure', type: 'boolean', implies: 'graph' })
    // Select to run in silent mode
    .option('silent', { desc: 'Silent mode (not verbose)', type: 'boolean' })
    // Examples
    .example('$0 -f ./foo.js -c ../config.json', 'process the foo.js file using the config.json options')
    .example('$0 -f ./foo.js -c ../config.json -i="AST"', 'process the foo.js file using the config.json options')
    .example('$0 -f ./foo.js -c ../config.json -if="__main__"', 'process the foo.js file using the config.json options')
    .help('h').alias('h', 'help');

const filename: string = argv.file as string;
const configFile: string = path.resolve(__dirname, argv.config as string);
const silentMode: boolean = argv.silent ?? false;
const normalizedPath: string = `${path.join(argv.o, 'normalized.js')}`;

// If silent mode is selected, do not show error traces
if (silentMode) console.trace = function () {};

// Verify arguments
if (!fs.existsSync(filename)) console.error(`${filename} is not a valid file.`);
if (!fs.existsSync(configFile)) console.error(`${configFile} is not a valid config file.`);

// Generate code property graph
const config = readConfig(configFile);


const depTree = dependencyTree({
    filename,
    directory: path.dirname(filename),
});



const graph = traverseDependecyGraph(depTree,config,path.dirname(normalizedPath),silentMode);

if (!graph) console.error(`Unable to generate code property graph`);

// Generate output files
const graphOptions = { ignore: argv.i ?? [], ignore_func: argv.if ?? [], show_code: argv.sc ?? false };

if (argv.csv) {
    graph.outputManager = new OutputManager(graphOptions, new CSVOutput());
    graph.output(argv.o);
}

if (argv.graph) {
    graph.outputManager = new OutputManager(graphOptions, new DotOutput());
    graph.output(argv.o);
    printDependencyGraph(depTree, path.join(argv.o, 'dependency_graph.txt'));
}

const statsFileName = path.join(argv.o, 'graph_stats.json')
fs.writeFileSync(statsFileName, `{ "edges": ${graph.edges.size}, "nodes": ${graph.nodes.size}}`)
