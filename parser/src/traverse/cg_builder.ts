import { type Graph } from "./graph/graph";
import { type GraphNode } from "./graph/node";
import { copyObj, getASTNode, getFDNode } from "../utils/utils";
import { type Config } from "../utils/config_reader";
import { type FContexts } from "./cfg_builder";

interface CallGraphReturn {
    callGraph: Graph
    config: Config
}

export function buildCallGraph(pdgGraph: Graph, functionContexts: FContexts, origConfig: Config): CallGraphReturn {
    const graph = pdgGraph;
    let newConfig: Config = copyObj(origConfig);
    const visitedNodes: number[] = [];

    function traverseCFG(node: GraphNode): void {
        if (node.type === "CFG_F_END") return;
        // console.log(node.id, node.functionContext);
        node.edges
            .filter((edge) => edge.type === "CFG")
            .map((edge) => {
                const n = edge.nodes[1];
                traverse(n);
            });
    }

    function addToConfigME(propName: string, objName: string, id: string, origConfig: Config): Config {
        const newConfig: Config = copyObj(origConfig);
        const functionSinks = newConfig.functions.filter(s => s.sink === propName);
        const packageSinks = newConfig.packagesSinks.filter(s => s.sink === propName);

        if (packageSinks.length > 0) {
            const sink = packageSinks.slice(-1)[0];
            const packages = sink.packages.filter(p => p.package === objName);

            if (packages.map(p => p.package).includes(objName)) {
                newConfig.functions.push({
                    sink: id,
                    args: packages[0].args
                });
            }
        }

        if (functionSinks.length > 0) {
            const sink = functionSinks.slice(-1)[0];
            newConfig.functions.push({
                sink: id,
                args: sink.args
            });
        }

        return newConfig;
    }

    function addToConfigID(idName: string, varName: string, origConfig: Config): Config {
        const newConfig: Config = copyObj(origConfig);
        const functionSinks = newConfig.functions.filter(s => s.sink === idName);

        if (functionSinks.length > 0) {
            const sink = functionSinks.slice(-1)[0];
            newConfig.functions.push({
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
                traverseCFG(node);
                break;
            }

            case "CFG_F_END": {
                traverseCFG(node);
                break;
            }

            case "VariableDeclarator": {
                // check init
                // if function add to context for future processing
                const init = getASTNode(node, "init");
                const id = node.obj.id;

                if (init) {
                    if (init.type === "Identifier") {
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
                    if (right.type === "Identifier") {
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
    return { callGraph: graph, config: newConfig };
}

module.exports = { buildCallGraph };
