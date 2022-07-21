import { OutputWriter } from "./output_writer";
import { Graph } from "../traverse/graph/graph";
import { GraphNode } from "../traverse/graph/node";
import { GraphEdge } from "../traverse/graph/edge";

import graphviz from "graphviz";
import escodegen from "escodegen";

function getNodeLabel(n: GraphNode, showCode: any) {
    let label = `#${n.id} ${n.type}`;
    if (n.obj) {
        switch (n.type) {
            case "PDG_OBJECT":
                // label = `#${n.id} ${n.type} ${n.identifier}`;
                label = `#${n.id} ${n.identifier}`;
                break;

            case "CFG_F_START":
            case "CFG_F_END":
                label = `#${n.id} ${n.type} ${n.identifier}`;
                break;

            case "Identifier": {
                label = `#${n.id} ${n.type} (${n.identifier})`;
                break;
            }

            case "VariableDeclarator": {
                const { init } = n.obj;
                label = `#${n.id} Variable (${n.identifier})`;

                if (init) {
                    if (showCode) {
                        if (init.type === "FunctionExpression"
                        || init.type === "ArrowFunctionExpression") {
                            const { namespace } = n.edges[0].nodes[1];
                            label = `#${n.id}» ${n.identifier} = Function (${namespace})`;
                        } else {
                            const code = escodegen.generate(n.obj);
                            // label = `#${n.id} ${n.type} \n\n${code}`;
                            label = `#${n.id}» ${code}`;
                        }
                    }
                }
                break;
            }

            case "ExpressionStatement": {
                if (showCode) {
                    const code = escodegen.generate(n.obj);
                    // label = `#${n.id} ${n.type} \n\n${code}`;
                    label = `#${n.id}» ${code}`;
                }
                break;
            }

            // case 'Literal':
            //     label = `#${n.id} ${n.type} (${n.obj.raw})`;
            //     break;

            case "UpdateExpression":
            case "UnaryExpression":
            case "BinaryExpression": {
                label = `#${n.id} ${n.type} (${n.obj.operator})`;
                break;
            }

            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                label = `#${n.id} Function (${n.identifier})`;
                break;
            }

            default:
                break;
        }
    }

    return label;
}

function getEdgeLabel(e: GraphEdge) {
    let label;

    switch (e.label) {
        case "VAR":
        case "NEW_VERSION":
        case "SUB_OBJECT":
        case "WRITE":
        case "LOOKUP":
        case "CREATE": {
            label = `${e.label} ${e.objName}`;
            break;
        }

        case "arg": {
            label = `${e.label} ${e.argumentIndex}`;
            break;
        }

        case "param": {
            label = `${e.label} ${e.paramIndex}`;
            break;
        }

        case "stmt": {
            label = e.stmtIndex;
            break;
        }

        case "element": {
            label = e.elementIndex;
            break;
        }

        default:
            label = e.label;
    }

    return label;
}

function getEdgeColor(e: GraphEdge) {
    let color;
    switch (e.type) {
        case "AST":
            color = "blue";
            break;
        case "CFG":
            color = "red";
            break;
        case "PDG":
            color = "darkgreen";
            break;
        default:
            color = "black";
    }

    return color;
}

function getNodeColor(n: GraphNode) {
    let color;
    if (n.obj) {
        switch (n.obj.type) {
            case "AST":
                color = "blue";
                break;
            case "CFG":
                color = "red";
                break;
            case "PDG":
                color = "darkgreen";
                break;
            default:
                color = "black";
        }
    }

    return color;
}

export class DotOutput extends OutputWriter {
    private showCode: any;

    output(graph: Graph, options: any, filename: string) {
        const gDot = graphviz.digraph("G");
        this.showCode = options.show_code || false;

        const nodesVisited: number[] = [];
        const nodesToPrint = [...graph.startNodes.entries()]
            .filter((entry) => !options.ignore.includes(entry[0]))
            .map((entry) => graph.startNodes.get(entry[0])).flat();

        while (nodesToPrint.length > 0) {
            const n = nodesToPrint.shift();
            if (n) {
                if (nodesVisited.includes(n.id)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (options.ignore && options.ignore.includes(n.obj.type)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                nodesVisited.push(n.id);
                let edges = n.edges;

                if (options.ignore) {
                    edges = n.edges.filter((e: GraphEdge) => !options.ignore.includes(e.type));
                }

                const nodeLabel = getNodeLabel(n, this.showCode);
                const nodeColor = getNodeColor(n);
                gDot.addNode(nodeLabel, { fontcolor: nodeColor, color: nodeColor });

                if (this.showCode && n.type === "ExpressionStatement") {
                    edges = n.edges.filter((e: GraphEdge) => e.type !== "AST");
                }

                if (this.showCode && n.type === "VariableDeclarator") {
                    const { init } = n.obj;

                    if (init && init.type !== "FunctionExpression" && init.type !== "ArrowFunctionExpression") {
                        edges = n.edges.filter((e: GraphEdge) => e.type !== "AST");
                    }
                }

                edges.forEach((e: GraphEdge) => {
                    const [n1, n2] = e.nodes;
                    if (n2.used) {
                        nodesToPrint.push(n2);

                        const edgeLabel = getEdgeLabel(e);

                        if (!options.ignore.includes(e.type)) {
                            const edgeColor = getEdgeColor(e);
                            gDot.addEdge(
                                getNodeLabel(n1, this.showCode),
                                getNodeLabel(n2, this.showCode),
                                {
                                    label: edgeLabel,
                                    fontcolor: edgeColor,
                                    color: edgeColor,
                                },
                            );
                        }
                    }

                    // nodesToPrint.push(n2);

                    // const edgeLabel = getEdgeLabel(e);

                    // if (!options.ignore.includes(e.type)) {
                    //     const edgeColor = getEdgeColor(e);
                    //     gDot.addEdge(
                    //         getNodeLabel(n1, this.showCode),
                    //         getNodeLabel(n2, this.showCode),
                    //         {
                    //             label: edgeLabel,
                    //             fontcolor: edgeColor,
                    //             color: edgeColor,
                    //         },
                    //     );
                    // }
                });
            }
        }

        // console.log(gDot.to_dot());
        gDot.output("svg", `${filename}.svg`);
    }
}