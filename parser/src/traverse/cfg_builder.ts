import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";

interface CFGReturnObject {
    root: GraphNode,
    exit: GraphNode
};

/* eslint-disable consistent-return */
function buildCFG(astGraph: Graph) {
    const graph = astGraph;

    function traverse(node: GraphNode, parentNode?: GraphNode): CFGReturnObject {
        function defaultNode(defNode: GraphNode) {
            defNode.edges.map((edge: GraphEdge) => traverse(edge.nodes[1], defNode));
            return {
                root: defNode,
                exit: defNode,
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
                exit: _end,
            };
        }

        // case "BlockStatement": {
        //     // let previousNode = node;
        //     let previousNode = parent_node;
        //     // console.log(node.edges);
        //     console.log(parent_node);

        //     node.edges.forEach(edge => {
        //         const [n, childNode] = edge.nodes;
        //         console.log(previousNode.id);
        //         const { root, exit } = traverse(childNode);
        //         graph.addEdge(previousNode.id, root.id, { type: "CFG" });
        //         previousNode = exit;
        //     });

        //     return {
        //         root: parent_node,
        //         exit: previousNode,
        //     };
        // }

        case "BlockStatement": {
            if (node.edges.length > 0) {
                let previousNode = node.edges[0].nodes[1];
                const firstNode = previousNode;

                node.edges.slice(1).forEach((edge) => {
                    const [, childNode] = edge.nodes;
                    const { root, exit } = traverse(childNode);
                    graph.addEdge(previousNode.id, root.id, { type: "CFG" });
                    previousNode = exit;
                });

                return {
                    root: firstNode,
                    exit: previousNode,
                };
            }

            return defaultNode(node);
        }

        case "ArrowFunctionExpression":
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "LabeledStatement": {
            const name = `${node.id}_${node.identifier}`;
            const cfgNamespace = `__${name}__`;

            const _start = graph.addNode("CFG_F_START", { type: "CFG" });
            _start.identifier = name;
            _start.namespace = cfgNamespace;
            _start.functionName = node.functionName;

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
            return {
                root: node,
                exit: node,
            };
        }

        case "IfStatement":
        case "ConditionalExpression": {
            const [test, consequent, alternate] = node.edges.map((edge) => traverse(edge.nodes[1]));

            const _endIf = graph.addNode("CFG_IF_END", { type: "CFG" });
            _endIf.identifier = node.id.toString();

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
                exit: _endIf,
            };
        }

        default:
            return defaultNode(node);
        }
    }

    const startASTNodes = graph.startNodes.get("AST");
    if (startASTNodes) traverse(startASTNodes[0]);
    return graph;
}

module.exports = { buildCFG };
