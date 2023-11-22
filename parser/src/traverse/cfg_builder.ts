import { type GraphEdge } from "./graph/edge";
import { type Graph } from "./graph/graph";
import { type GraphNode } from "./graph/node";

interface CFGReturnObject {
    root: GraphNode
    exit: GraphNode
}

// FContexts represents a map of function ids to the contexts in which they exist
// This is important to check if a function can be called from a given instance?
export type FContexts = Map<number, number[]>;
// CFGraphReturn represents the return of the CFG analysis -> graph and function contexts
export interface CFGraphReturn { graph: Graph, functionContexts: FContexts }

function buildCFG(astGraph: Graph): CFGraphReturn {
    const graph: Graph = astGraph;
    const intraContextStack: number[] = new Array<number>();
    const functionContexts: FContexts = new Map();
    // string is function name <context>.<name>, number is nodeId (function declaration node) --> to be able to quickly find the param nodes
    const functionList: Map<string, number> = new Map<string, number>();
    /* unknownCalls
        - Stores the calls that do not yet have the function defined (e.g. calling a function only defined afterward)
        - Map<string, string[]>: fnName --> [#C.#N] where #C is the context number where the function is called and #N is the CFG node that calls the function
     */
    const unknownCalls: Map<string, string[]> = new Map<string, string[]>();

    // This function adds the
    function addFunctionContext(functionId: number): void {
        if (intraContextStack.length > 0) {
            const lastContext = intraContextStack.slice(-1)[0];
            const contextFunctions = functionContexts.get(lastContext)
            if (contextFunctions) {
                functionContexts.set(functionId, [...contextFunctions, lastContext]);
            } else {
                functionContexts.set(functionId, [lastContext]);
            }
        } else {
            functionContexts.set(functionId, []);
        }
    }

    // This function check if any previously analyzed function has call the function received as arguments (functionName)
    function checkUnknownCalledFunctions(node: GraphNode, calledFunctionId: number, parentNode: GraphNode | undefined): void {
        let calls: string[] | undefined = []
        if (node.type !== "MemberExpression") {
            calls = node.functionName ? unknownCalls.get(node.functionName) : undefined // calls store the unknown calls to the function received as argument (functionName)
        } else {
            const name: string = `${node.obj.object.name}.${node.obj.property.name}`;
            calls = unknownCalls.get(name) ?? []
        }
        if (!calls) return;
        calls.forEach((calleeFunction: string) => { // for each unknown call that matches the name
            const [context, nodeId] = calleeFunction.split(".").map((value: string) => parseInt(value))
            if (node.type !== "MemberExpression") {
                const possibleContexts: number[] = functionContexts.get(context) ?? [] // the defined function can be defined in the higher contexts of the callee function
                const innerContext = possibleContexts.reverse().find((ctx: number) => ctx === node.functionContext);
                // If there is no inner context, then the unknown call could have not called the current function (maybe the current function is in an outer scope)
                if (!innerContext) return;
                const stmtId = graph.nodes.get(nodeId)?.edges.filter((edge: GraphEdge) => edge.type === "AST" && edge.label === "init").map((edge: GraphEdge) => edge.nodes[1])[0]
                graph.addEdge(nodeId, calledFunctionId, { type: "CG", label: "CG" })
                if (stmtId) graph.addEdge(stmtId.id, calledFunctionId, { type: "CG", label: "CG" })
            } else if (parentNode) {
                const possibleContexts: number[] = Array.from(functionContexts).filter(([key, value]) => value.includes(calledFunctionId))
                    .map(([key, value]) => key); // the defined function can be defined in the higher contexts of the callee function or in the same context
                const functionName: string = parentNode.obj.right.name;
                const functionId: number | undefined = functionList.get(`${calledFunctionId}.${functionName}`)
                if (!functionId) return;
                const stmtId = graph.nodes.get(nodeId)?.edges.filter((edge: GraphEdge) => edge.type === "AST" && edge.label === "init").map((edge: GraphEdge) => edge.nodes[1])[0]
                graph.addEdge(nodeId, functionId, { type: "CG", label: "CG" })
                if (stmtId) graph.addEdge(stmtId.id, functionId, { type: "CG", label: "CG" })
            }

        })
    }

    function addToUnknownCalls(functionName: string, callContext: number, callNodeId: number): void {
        const newCall = `${callContext}.${callNodeId}`
        if (unknownCalls.has(functionName)) { // if function is already in map structure
            // @ts-expect-error - we are already checking if undefined
            unknownCalls.get(functionName).push(newCall)
        } else {
            unknownCalls.set(functionName, [newCall])
        }
    }

    function traverse(node: GraphNode, context: number, parentNode?: GraphNode): CFGReturnObject {
        function defaultNode(defNode: GraphNode): CFGReturnObject {
            defNode.edges.filter((edge: GraphEdge) => edge.type !== "CG").map((edge: GraphEdge) => {
                return traverse(edge.nodes[1], defNode.functionContext, defNode)
            });
            return {
                root: defNode,
                exit: defNode
            };
        }

        node.functionContext = context;
        switch (node.type) {
        //
        // Scripts
        //
            case "Program": {
                const cfgNamespace = "__main__";

                const _start = graph.addNode("CFG_F_START", { type: "CFG" });
                _start.identifier = "__main__";
                _start.namespace = cfgNamespace;
                _start.functionContext = _start.id;
                intraContextStack.push(_start.id);
                _start.functionNodeId = node.id;
                graph.addStartNodes("CFG", _start);

                const _end = graph.addNode("CFG_F_END", { type: "CFG" });
                _end.identifier = "__main__";

                let previousNode = _start;
                node.edges.forEach((edge) => {
                    const [, childNode] = edge.nodes;
                    const { root, exit } = traverse(childNode, _start.functionContext);
                    graph.addEdge(previousNode.id, root.id, { type: "CFG" });
                    previousNode = exit;
                });
                graph.addEdge(previousNode.id, _end.id, { type: "CFG" });
                intraContextStack.pop()
                return {
                    root: _start,
                    exit: _end
                };
            }

            case "BlockStatement": {
                if (node.edges.length > 0) {
                    const firstNode = traverse(node.edges[0].nodes[1], node.functionContext);
                    let previousNode = firstNode.exit;

                    node.edges.slice(1).forEach((edge) => {
                        const [, childNode] = edge.nodes;
                        const { root, exit } = traverse(childNode, node.functionContext);
                        graph.addEdge(previousNode.id, root.id, { type: "CFG" });
                        previousNode = exit;
                    });

                    return {
                        root: firstNode.root,
                        exit: previousNode
                    };
                }

                return defaultNode(node);
            }

            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                const name = `${node.id}_${node.identifier ?? ""}`;
                const cfgNamespace = `__${name}__`;

                const _start = graph.addNode("CFG_F_START", { type: "CFG" });
                _start.identifier = name;
                _start.namespace = cfgNamespace;
                _start.functionName = node.functionName;
                _start.functionContext = _start.id;
                addFunctionContext(_start.id)
                intraContextStack.push(_start.id);
                if (parentNode) _start.functionNodeId = parentNode.id;
                if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression")) {
                    // Check if a previous function has called this one
                    if (node.functionName) {
                        checkUnknownCalledFunctions(node, _start.functionNodeId, parentNode)
                    }
                    // && !node.functionName?.match("[v]\\d+")) { // Not generated by the normalization
                    const functionNode = graph.nodes.get(_start.functionNodeId)
                    if (functionNode) functionNode.arguments = true;
                }
                // Add function to functionList
                if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && parentNode) {
                    const functionContextName = `${node.functionContext}.${node.functionName ?? ""}`
                    functionList.set(functionContextName, parentNode.id);
                    // if (intraContextStack.length < 3 && node.functionName) outerFunctions.push(node.functionName)
                } else if (node.type === "ArrowFunctionExpression" && parentNode && parentNode.type === "VariableDeclarator") { // && parent && parent.type === "VariableDeclarator"
                    const functionContextName = `${node.functionContext}.${parentNode.obj.id.name}`
                    functionList.set(functionContextName, parentNode.id)
                    // if (intraContextStack.length === 1 && node.functionName) outerFunctions.push(node.functionName):
                }

                graph.addStartNodes("CFG", _start);
                node.namespace = cfgNamespace;

                const _end = graph.addNode("CFG_F_END", { type: "CFG" });
                _end.identifier = name;

                const blockEdge = node.edges.filter((edge) => edge.label === "block")[0];
                const blockNode = blockEdge.nodes[1];
                const { root, exit } = traverse(blockNode, _start.id);
                graph.addEdge(_start.id, root.id, { type: "CFG" });
                graph.addEdge(exit.id, _end.id, { type: "CFG" });
                intraContextStack.pop()

                const parentNodeId = parentNode?.id;
                if (parentNodeId) {
                    graph.addEdge(parentNodeId, _start.id, { type: "FD", label: "FD" });
                }
                graph.addEdge(node.id, _start.id, { type: "FD", label: "FD" });
                return {
                    root: node,
                    exit: node
                };
            }

            case "CallExpression": {
                let calledFunction: string = ""
                if (node.obj.callee.type === "Identifier") calledFunction = node.obj.callee.name;
                else if (node.obj.callee.type === "MemberExpression") calledFunction = `${node.obj.callee.object.name}.${node.obj.callee.property.name}`;
                const functionContextList: number[] = functionContexts.get(node.functionContext) ?? []
                const currentFunctionContextList: number[] = [...functionContextList] // To avoid make changes to the array in the following computations
                currentFunctionContextList.push(node.functionContext)
                let isFunctionDeclared: boolean = false;
                currentFunctionContextList.reverse().forEach((currentContext: number) => {
                    const calledFunctionId = functionList.get(`${currentContext}.${calledFunction}`)
                    if (calledFunctionId !== undefined && parentNode && !isFunctionDeclared) {
                        graph.addEdge(parentNode.id, calledFunctionId, { type: "CG", label: "CG" })
                        graph.addEdge(node.id, calledFunctionId, { type: "CG", label: "CG" })
                        isFunctionDeclared = true;
                    }
                });
                if (!isFunctionDeclared && (node.obj.callee.type === "Identifier")) addToUnknownCalls(calledFunction, node.functionContext, parentNode ? parentNode.id : node.id)
                else if (!isFunctionDeclared && (node.obj.callee.type === "MemberExpression") && (node.obj.callee.object.name === "exports")) addToUnknownCalls(calledFunction, node.functionContext, parentNode ? parentNode.id : node.id)
                return defaultNode(node);
            }

            case "IfStatement":
            case "ConditionalExpression": {
                const [test, consequent, alternate] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endIf = graph.addNode("CFG_IF_END", { type: "CFG" });
                _endIf.identifier = node.id.toString();
                node.cfgEndNodeId = _endIf.id;

                graph.addEdge(node.id, test.root.id, { type: "CFG", label: "test" });
                graph.addEdge(test.exit.id, consequent.root.id, { type: "CFG", label: "TRUE" });
                graph.addEdge(consequent.exit.id, _endIf.id, { type: "CFG" });

                if (alternate) {
                    graph.addEdge(test.exit.id, alternate.root.id, { type: "CFG", label: "FALSE" });
                    graph.addEdge(alternate.exit.id, _endIf.id, { type: "CFG" });
                } else {
                    graph.addEdge(test.exit.id, _endIf.id, { type: "CFG", label: "FALSE" });
                }

                return {
                    root: node,
                    exit: _endIf
                };
            }

            case "SwitchStatement": {
                const [discriminant, ...cases] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endSwitch = graph.addNode("CFG_SWITCH_END", { type: "CFG" });
                _endSwitch.identifier = node.id.toString();
                node.cfgEndNodeId = _endSwitch.id;

                for (let i = 0; i < cases.length; i++) {
                    graph.addEdge(node.id, cases[i].root.id, { type: "CFG", label: "case" });
                    graph.addEdge(cases[i].exit.id, _endSwitch.id, { type: "CFG" });
                }

                return {
                    root: node,
                    exit: _endSwitch
                };
            }

            case "SwitchCase": {
                const [test, ...consequent] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endSwitch = graph.addNode("CFG_SWITCH_CASE_END", { type: "CFG" });
                _endSwitch.identifier = node.id.toString();
                node.cfgEndNodeId = _endSwitch.id;

                if (test) {
                    graph.addEdge(node.id, test.root.id, {type: "CFG", label: "test"});
                    if (!consequent || !consequent.length) {
                        graph.addEdge(test.exit.id, _endSwitch.id, {type: "CFG"});
                    } else {
                        graph.addEdge(test.exit.id, consequent[0].root.id, {type: "CFG", label: "TRUE"});
                        let previousNode = consequent[0].exit
                        consequent.slice(1).forEach(consequentNode => {
                            graph.addEdge(previousNode.id, consequentNode.root.id, {type: "CFG"});
                            previousNode = consequentNode.exit;
                        })
                        graph.addEdge(previousNode.id, _endSwitch.id, {type: "CFG"});
                    }
                }

                return {
                    root: node,
                    exit: _endSwitch
                };
            }


            case "WhileStatement": {
                const [test, body] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endIf = graph.addNode("CFG_WHILE_END", { type: "CFG" });
                _endIf.identifier = node.id.toString();
                graph.addEdge(node.id, test.root.id, { type: "CFG", label: "test" });

                graph.addEdge(test.exit.id, body.root.id, { type: "CFG", label: "TRUE" });
                graph.addEdge(test.exit.id, _endIf.id, { type: "CFG", label: "FALSE" });
                graph.addEdge(body.exit.id, _endIf.id, { type: "CFG" });

                return {
                    root: node,
                    exit: _endIf
                };
            }

            case "TryStatement": {
                const [block, handler, finalizer] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endIf = graph.addNode("CFG_TRY_STMT_END", { type: "CFG" });
                _endIf.identifier = node.id.toString();

                graph.addEdge(node.id, block.root.id, { type: "CFG" });

                if (handler) {
                    graph.addEdge(node.id, handler.root.id, { type: "CFG", label: "EXCEPT" });
                    if (finalizer) {
                        graph.addEdge(handler.exit.id, finalizer.root.id, { type: "CFG", label: "FINALLY" });
                        graph.addEdge(block.exit.id, finalizer.root.id, { type: "CFG", label: "FINALLY" });
                        graph.addEdge(finalizer.exit.id, _endIf.id, { type: "CFG" });
                    } else {
                        graph.addEdge(handler.exit.id, _endIf.id, { type: "CFG" });
                        graph.addEdge(block.exit.id, _endIf.id, { type: "CFG" });
                    }
                } else {
                    if (finalizer) {
                        graph.addEdge(block.exit.id, finalizer.root.id, { type: "CFG", label: "FINALLY" });
                        graph.addEdge(finalizer.exit.id, _endIf.id, { type: "CFG" });
                    } else {
                        graph.addEdge(block.exit.id, _endIf.id, { type: "CFG" });
                    }
                }

                return {
                    root: node,
                    exit: _endIf
                };
            }

            case "CatchClause": {
                const [body] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                graph.addEdge(node.id, body.root.id, { type: "CFG" });

                return {
                    root: node,
                    exit: body.exit
                };
            }

            // Due to the normalization, this does not happen? TODO
            case "ForOfStatement":
            case "ForInStatement": {
                const [left, right, body] = node.edges.map((edge) => traverse(edge.nodes[1], node.functionContext));

                const _endIf = graph.addNode("FOR_END", { type: "CFG" });
                _endIf.identifier = node.id.toString();

                graph.addEdge(node.id, left.root.id, { type: "CFG" });

                graph.addEdge(left.root.id, body.root.id, { type: "CFG", label: "init" });
                graph.addEdge(left.root.id, _endIf.id, { type: "CFG", label: "end" });
                graph.addEdge(body.exit.id, _endIf.id, { type: "CFG" });

                return {
                    root: node,
                    exit: _endIf
                };
            }

            case "MemberExpression":
                // Check if defining an unknown call
                if (parentNode && parentNode.type === "AssignmentExpression") {
                    checkUnknownCalledFunctions(node, node.functionContext, parentNode)
                }
                return defaultNode(node);

            // Types of nodes that don't make changes in the CFG
            case "Literal":
            case "Identifier":
            case "VariableDeclarator":
            case "ObjectExpression":
            case "Property":
            case "ExpressionStatement":
            case "AssignmentExpression":
            case "ReturnStatement":
            case "BinaryExpression":
            case "ArrayExpression":
            case "TemplateLiteral":
            case "NewExpression":
            case "ThisExpression":
            case "LogicalExpression":
            case "UnaryExpression":
            case "UpdateExpression":
            case "ThrowStatement":
            case "SequenceExpression":
                return defaultNode(node);

            // TODO: Not sure if doesn't make changes
            case "YieldExpression":
            case "AwaitExpression":
                return defaultNode(node);
            case "CFG_F_START":
            case "CFG_F_END": {
                return {
                    root: node,
                    exit: node
                };
            }

            default:
                console.trace(`Expression ${node.type} didn't match with case values.`);
                return defaultNode(node);
        }
    }

    const startASTNodes = graph.startNodes.get("AST");
    if (startASTNodes) traverse(startASTNodes[0], -1);
    //console.log(functionList)
    //console.log(unknownCalls)
    return { graph, functionContexts };
}

module.exports = { buildCFG };
