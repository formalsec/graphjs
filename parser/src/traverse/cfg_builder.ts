import { type GraphEdge } from "./graph/edge";
import { type Graph } from "./graph/graph";
import { type GraphNode } from "./graph/node";

interface CFGReturnObject {
    root: GraphNode
    exit: GraphNode
}

function buildCFG(astGraph: Graph): Graph {
    const graph = astGraph;

    function traverse(node: GraphNode, parentNode?: GraphNode): CFGReturnObject {
        function defaultNode(defNode: GraphNode): CFGReturnObject {
            defNode.edges.map((edge: GraphEdge) => traverse(edge.nodes[1], defNode));
            return {
                root: defNode,
                exit: defNode
            };
        }

        // if (node === null) {
        //     return null;
        // }

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
                _start.functionNodeId = node.id;
                graph.addStartNodes("CFG", _start);

                const _end = graph.addNode("CFG_F_END", { type: "CFG" });
                _end.identifier = "__main__";

                let previousNode = _start;
                node.edges.forEach((edge) => {
                    const [, childNode] = edge.nodes;
                    const { root, exit } = traverse(childNode);
                    graph.addEdge(previousNode.id, root.id, { type: "CFG" });
                    previousNode = exit;
                });
                graph.addEdge(previousNode.id, _end.id, { type: "CFG" });
                return {
                    root: _start,
                    exit: _end
                };
            }

            case "BlockStatement": {
                if (node.edges.length > 0) {
                    const firstNode = traverse(node.edges[0].nodes[1]);
                    let previousNode = firstNode.exit;

                    node.edges.slice(1).forEach((edge) => {
                        const [, childNode] = edge.nodes;
                        const { root, exit } = traverse(childNode);
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
                _start.functionNodeId = node.id;

                graph.addStartNodes("CFG", _start);
                // eslint-disable-next-line no-param-reassign
                node.namespace = cfgNamespace;

                const _end = graph.addNode("CFG_F_END", { type: "CFG" });
                _end.identifier = name;

                const blockEdge = node.edges.filter((edge) => edge.label === "block")[0];
                const blockNode = blockEdge.nodes[1];
                const { root, exit } = traverse(blockNode);
                graph.addEdge(_start.id, root.id, { type: "CFG" });
                graph.addEdge(exit.id, _end.id, { type: "CFG" });

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

            case "IfStatement":
            case "ConditionalExpression": {
                const [test, consequent, alternate] = node.edges.map((edge) => traverse(edge.nodes[1]));

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

            case "WhileStatement": {
                const [test, body] = node.edges.map((edge) => traverse(edge.nodes[1]));

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
                const [block, handler, finalizer] = node.edges.map((edge) => traverse(edge.nodes[1]));

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
                const [body] = node.edges.map((edge) => traverse(edge.nodes[1]));

                graph.addEdge(node.id, body.root.id, { type: "CFG" });

                return {
                    root: node,
                    exit: body.exit
                };
            }

            // Due to the normalization, this does not happen? TODO
            case "ForOfStatement":
            case "ForInStatement": {
                const [left, right, body] = node.edges.map((edge) => traverse(edge.nodes[1]));

                const _endIf = graph.addNode("FOR_END", { type: "CFG" });
                _endIf.identifier = node.id.toString();

                graph.addEdge(node.id, left.root.id, { type: "CFG" });
                graph.addEdge(left.exit.id, body.root.id, { type: "CFG" });
                graph.addEdge(body.exit.id, right.root.id, { type: "CFG" });
                graph.addEdge(right.exit.id, node.id, { type: "CFG" });
                graph.addEdge(right.exit.id, _endIf.id, { type: "CFG" });

                return {
                    root: node,
                    exit: _endIf
                };
            }

            // Types of nodes that don't make changes in the CFG
            case "Literal":
            case "Identifier":
            case "VariableDeclarator":
            case "ObjectExpression":
            case "Property":
            case "ExpressionStatement":
            case "AssignmentExpression":
            case "MemberExpression":
            case "CallExpression":
            case "ReturnStatement":
            case "BinaryExpression":
            case "ArrayExpression":
            case "TemplateLiteral":
            case "NewExpression":
            case "ThisExpression":
            case "LogicalExpression":
            case "UnaryExpression":
            case "UpdateExpression":
                return defaultNode(node);

            default:
                console.trace(`Expression ${node.type} didn't match with case values.`);
                return defaultNode(node);
        }
    }

    const startASTNodes = graph.startNodes.get("AST");
    if (startASTNodes) traverse(startASTNodes[0]);
    return graph;
}

module.exports = { buildCFG };
