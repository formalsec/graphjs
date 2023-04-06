import { type Graph } from "./graph/graph";
import { type GraphNode } from "./graph/node";
import { copyObj, getASTNode, getFDNode } from "../utils/utils";
import { type Config } from "../utils/config_reader";

type GFunctions = Map<string, Map<string, number>>;

class GraphFunctions {
    // This value represents TODO
    private gFunctions: GFunctions;
    // This value represents the context stack of
    private intraContextStack: string[];

    constructor() {
        this.gFunctions = new Map();
        this.intraContextStack = new Array<string>();
    }

    pushContext(namespace: string): void {
        this.intraContextStack.push(namespace);
    }

    popContext(): string | undefined {
        return this.intraContextStack.pop();
    }

    getRecentContext(): string {
        return this.intraContextStack.slice(-1)[0];
    }

    getParentContext(): string {
        return this.intraContextStack[0];
    }

    addFunctionToContext(functionNode: GraphNode): void {
        if (functionNode.functionName) {
            const context = this.getRecentContext();
            let contextMap = this.gFunctions.get(context);
            if (!contextMap) {
                contextMap = new Map();
            }
            contextMap.set(functionNode.functionName, functionNode.id);
            this.gFunctions.set(context, contextMap);
        }
    }

    addFunctionCall(stmtId: number, callee: GraphNode, graph: Graph): void {
        const functionName = callee.identifier;
        const context = this.getParentContext();
        const contextMap = this.gFunctions.get(context);

        if (contextMap && functionName) {
            const fStartNodeId = contextMap.get(functionName);
            if (fStartNodeId) graph.addEdge(stmtId, fStartNodeId, { type: "CG", label: "CG" });
        }
    }

    print(): void {
        console.log("Functions:", this.gFunctions);
    }
}

interface CallGraphReturn {
    callGraph: Graph
    config: Config
}

function buildCallGraph(pdgGraph: Graph, origConfig: Config): CallGraphReturn {
    const graph = pdgGraph;
    let newConfig: Config = copyObj(origConfig);
    const gFunctions = new GraphFunctions();
    const visitedNodes: number[] = [];

    const ctxVisitedNodes: number[] = [];

    function traverseContext(node: GraphNode): void {
        if (ctxVisitedNodes.includes(node.id) || node.type === "CFG_F_END" || node.type === "BlockStatement") return;
        // console.log(node.id, node.functionContext);
        node.edges
            .filter((edge) => edge.type === "AST")
            .map((edge) => {
                const n = edge.nodes[1];
                n.functionContext = node.functionContext;
                traverseContext(n);
            });
        ctxVisitedNodes.push(node.id);
    }

    function traverseCFG(node: GraphNode): void {
        if (node.type === "CFG_F_END") return;
        // console.log(node.id, node.functionContext);
        node.edges
            .filter((edge) => edge.type === "CFG")
            .map((edge) => {
                const n = edge.nodes[1];
                n.functionContext = node.functionContext;
                traverse(n);
                traverseContext(n);
            });
    }

    function addToConfigME(propName: string, objName: string, id: string, origConfig: Config): Config {
        const newConfig: Config = copyObj(origConfig);
        const fsinks = newConfig.functions.filter(s => s.sink === propName);
        const psinks = newConfig.packagesSinks.filter(s => s.sink === propName);

        if (psinks.length > 0) {
            const sink = psinks.slice(-1)[0];
            const packages = sink.packages.filter(p => p.package === objName);

            if (packages.map(p => p.package).includes(objName)) {
                newConfig["functions"].push({
                    sink: id,
                    args: packages[0].args
                });
            }
        }

        if (fsinks.length > 0) {
            const sink = fsinks.slice(-1)[0];
            newConfig["functions"].push({
                sink: id,
                args: sink.args
            });
        }

        return newConfig;
    }

    function addToConfigID(idName: string, varName: string, origConfig: Config): Config {
        const newConfig: Config = copyObj(origConfig);
        const fsinks = newConfig.functions.filter(s => s.sink === idName);

        if (fsinks.length > 0) {
            const sink = fsinks.slice(-1)[0];
            newConfig["functions"].push({
                sink: varName,
                args: sink.args
            });
        }

        return newConfig;
    }

    function traverse(node: GraphNode): void {
        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        switch (node.type) {
            case "CFG_F_START": {
                if (node.namespace) {
                    gFunctions.pushContext(node.namespace);
                }
                traverseCFG(node);
                break;
            }

            case "CFG_F_END": {
                gFunctions.popContext();
                traverseCFG(node);
                break;
            }

            case "VariableDeclarator": {
                // check init
                // if function add to context for future processing
                const init = getASTNode(node, "init");
                const id = node.obj.id;

                if (init) {
                    if (init.type === "CallExpression" || init.type === "NewExpression") {
                        const callee = getASTNode(init, "callee");
                        gFunctions.addFunctionCall(node.id, callee, graph);
                    } else if (init.type === "Identifier") {
                        const idName = init.obj.name;
                        newConfig = addToConfigID(idName, id.name, newConfig);
                    } else if (init.type === "MemberExpression") {
                        const obj = getASTNode(init, "object");
                        const prop = getASTNode(init, "property");
                        const objName = obj.obj.name;
                        if (prop.type === "Identifier") {
                            const propName = prop.obj.name;
                            newConfig = addToConfigME(propName, objName, id.name, newConfig);
                        }
                    }
                } else {
                    const fd = getFDNode(node);
                    if (fd) {
                        gFunctions.addFunctionToContext(fd);
                        traverse(fd);
                    }
                }
                traverseCFG(node);
                break;
            }

            // expression statements are the majority of statements
            case "AssignmentExpression": {
                const left = getASTNode(node, "left");
                const right = getASTNode(node, "right");
                if (left && left.type === "Identifier" && right) {
                    if (right.type === "CallExpression" || right.type === "NewExpression") {
                        const callee = getASTNode(right, "callee");
                        gFunctions.addFunctionCall(node.id, callee, graph);
                    } else if (right.type === "Identifier") {
                        const idName = right.obj.name;
                        newConfig = addToConfigID(idName, left.obj.name, newConfig);
                    } else if (right.type === "MemberExpression") {
                        const obj = getASTNode(right, "object");
                        const prop = getASTNode(right, "property");
                        const objName = obj.obj.name;
                        if (prop.type === "Identifier") {
                            const propName = prop.obj.name;
                            newConfig = addToConfigME(propName, objName, left.obj.name, newConfig);
                        }
                    }
                }
                traverseCFG(node);
                break;
            }

            default:
                traverseCFG(node);
        }
    }

    graph.startNodes.get("CFG")?.forEach(n => { traverse(n); });
    // gFunctions.print();
    newConfig.summaries = origConfig.summaries;
    return { callGraph: graph, config: newConfig };
}

module.exports = { buildCallGraph };
