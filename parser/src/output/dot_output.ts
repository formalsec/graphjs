import { OutputWriter } from "./output_writer";
import { type Graph } from "../traverse/graph/graph";
import { type GraphNode } from "../traverse/graph/node";
import { type GraphEdge } from "../traverse/graph/edge";
import path from "path";
import graphviz from "graphviz";
import escodegen from "escodegen";

function getNodeLabel(n: GraphNode, showCode: any): string {
    let label = `#${n.id} ${n.type} (${n.functionContext})`;
    if (n.obj) {
        switch (n.type) {
            case "TAINT_SOURCE":
                label = `#${n.id} ${n.type}`;
                break;

            case "TAINT_SINK":
                label = `#${n.id} ${n.type} (${n.identifier ?? "?"})`;
                break;

            case "PDG_OBJECT":
            case "PDG_CALL":
            case "PDG_RETURN":
            case "PDG_PARAM":
                // label = `#${n.id} ${n.type} ${n.identifier}`;
                label = `#${n.id} ${n.identifier ?? "?"}`;
                break;

            case "CFG_F_START":
            case "CFG_F_END":
                label = `#${n.id} ${n.type} ${n.identifier ?? "?"}`;
                break;

            case "Identifier": {
                label = `#${n.id} ${n.type} (${n.identifier ?? "?"}) - (${n.functionContext})`;
                break;
            }

            case "VariableDeclarator": {
                const { init } = n.obj;
                label = `#${n.id} Variable (${n.identifier ?? "?"}) - (${n.functionContext})`;

                if (init) {
                    if (showCode) {
                        if (init.type === "FunctionExpression" ||
                        init.type === "ArrowFunctionExpression") {
                            const { namespace } = n.edges[0].nodes[1];
                            label = `#${n.id}» ${n.identifier ?? "?"} = Function (${namespace ?? "?"}) - (${n.functionContext})`;
                        } else {
                            const code = escodegen.generate(n.obj);
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
                    label = `#${n.id}» ${code} - (${n.functionContext})`;
                }
                break;
            }

            case "UpdateExpression":
            case "UnaryExpression":
            case "BinaryExpression": {
                label = `#${n.id} ${n.type} (${n.obj.operator as string}) - (${n.functionContext})`;
                break;
            }

            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                label = `#${n.id} Function (${n.identifier ?? "?"}) - (${n.functionContext})`;
                break;
            }

            case "ReturnStatement": {
                if (showCode) {
                    const code: string = escodegen.generate(n.obj);
                    label = `#${n.id}» ${code}`;
                }
                break;
            }

            default:
                break;
        }
    }

    return label;
}

function getEdgeLabel(e: GraphEdge): string | number {
    let label;

    switch (e.label) {
        case "NV":
        case "SO":
        case "ARG":
        case "DEP": {
            label = `${e.label}(${e.objName})`;
            break;
        }

        case "CALLEE":
        case "REF":
        case "WRITE":
        case "LOOKUP":
        case "CREATE": {
            if (e.sourceObjName !== "") {
                label = `${e.label} ${e.objName} (${e.sourceObjName})`;
            } else {
                label = `${e.label} ${e.objName}`;
            }
            break;
        }
        case "SINK": {
            label = `${e.label} (${e.objName})`;
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

        case "method": {
            label = e.methodIndex;
            break;
        }

        case "specifier": {
            label = e.specifierIndex;
            break;
        }

        default:
            label = e.label;
    }

    return label;
}

function getEdgeColor(e: GraphEdge): string {
    let color;
    switch (e.type) {
        case "AST":
            color = "blue";
            break;
        case "CFG":
            color = "red";
            break;
        case "SUB":
        case "PDG":
            color = "darkgreen";
            break;
        case "CG":
            color = "goldenrod3";
            break;
        default:
            color = "black";
    }

    return color;
}

function getEdgeStyle(e: GraphEdge): string {
    let style;
    switch (e.type) {
        case "REF":
        case "SINK":
            style = "dashed";
            break;
        default:
            style = "solid";
    }

    return style;
}

function getNodeColor(n: GraphNode): string | undefined {
    let color;
    if (n.exported) {
        return "darkviolet";
    }

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
            case "TAINT":
                color = "goldenrod4";
                break;
            default:
                color = "black";
        }
    }

    return color;
}

export class DotOutput extends OutputWriter {
    private showCode: any;

    output(graph: Graph, options: any, filename: string): void {
        const gDot = graphviz.digraph("G");
        this.showCode = options.show_code || false;

        const nodesVisited: number[] = [];
        const nodesToPrint = [...graph.startNodes.entries()]
            .filter((entry) => !options.ignore.includes(entry[0]))
            .map((entry) => graph.startNodes.get(entry[0])).flat();

        nodesToPrint.push(graph.nodes.get(graph.taintNode));

        while (nodesToPrint.length > 0) {
            const n: GraphNode | undefined = nodesToPrint.shift();
            if (n) {
                if (nodesVisited.includes(n.id)) {
                    continue;
                }

                if (options.ignore?.includes(n.obj.type)) {
                    continue;
                }

                if (options.ignore_func?.includes(n.identifier)) {
                    continue;
                }

                nodesVisited.push(n.id);
                let edges: GraphEdge[] = n.edges;

                if (options.ignore) {
                    edges = n.edges.filter((e: GraphEdge) => !options.ignore.includes(e.type));
                }

                const nodeLabel: string = getNodeLabel(n, this.showCode);
                const nodeColor: string | undefined = getNodeColor(n);
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
                            const edgeStyle = getEdgeStyle(e);
                            gDot.addEdge(
                                getNodeLabel(n1, this.showCode),
                                getNodeLabel(n2, this.showCode),
                                {
                                    label: edgeLabel,
                                    fontcolor: edgeColor,
                                    color: edgeColor,
                                    style: edgeStyle
                                }
                            );
                        }
                    }
                });
            }
        }

        // console.log(gDot.to_dot());
        gDot.output("svg", path.join(filename, "graph.svg"));
    }
}
