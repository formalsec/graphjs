const graphviz = require('graphviz');
const escodegen = require('escodegen');

class DotOutput {
    getNodeLabel(n) {
        let label = `#${n.id} ${n.type}`;
        if (n.obj) {
            switch(n.type) {
                case 'PDG_OBJECT':
                    label = `#${n.id} ${n.type} ${n.identifier}`;
                    break;

                case 'CFG_F_START':
                case 'CFG_F_END':
                    label = `#${n.id} ${n.type} ${n.identifier}`;
                    break;

                case 'Identifier': {
                    label = `#${n.id} ${n.type} (${n.identifier})`;
                    break;
                }

                case 'VariableDeclarator': {
                    const init = n.obj.init;
                    label = `#${n.id} Variable (${n.identifier})`;

                    if (init && init.type != "FunctionExpression") {
                        if (this.show_code) {
                            const code = escodegen.generate(n.obj);
                            // label = `#${n.id} ${n.type} \n\n${code}`;
                            label = `#${n.id}» ${code}`;
                        }
                    }
                    break;
                }

                case 'ExpressionStatement': {
                    if (this.show_code) {
                        const code = escodegen.generate(n.obj);
                        // label = `#${n.id} ${n.type} \n\n${code}`;
                        label = `#${n.id}» ${code}`;
                    }
                    break;
                }

                // case 'Literal':
                //     label = `#${n.id} ${n.type} (${n.obj.raw})`;
                //     break;

                case 'UpdateExpression':
                case 'UnaryExpression':
                case 'BinaryExpression': {
                    label = `#${n.id} ${n.type} (${n.obj.operator})`;
                    break;
                }

                case "ArrowFunctionExpression":
                case "FunctionDeclaration":
                case "FunctionExpression":
                case "LabeledStatement": {
                    label = `#${n.id} Function (${n.identifier})`;
                }
            }
        }

        return label;
    }

    getEdgeLabel(e) {
        let label = '';

        switch(e.label) {
            case 'WRITE':
            case 'LOOKUP':
            case 'CREATE':
                label = `${e.label} ${e.obj_name}`;
                break;

            case 'arg':
                label = `${e.label} ${e.argument_index}`;
                break;

            case 'param':
                label = `${e.label} ${e.param_index}`;
                break;

            case 'stmt':
                label = e.stmt_index;
                break;

            default:
                label = e.label;
        }

        return label;
    }

    getEdgeColor(e) {
        let color = 'black';
        switch (e.type) {
            case 'AST':
                color = 'blue';
                break;
            case 'CFG':
                color = 'red';
                break;
            case 'PDG':
                color = 'darkgreen';
                break;
        }

        return color;
    }

    getNodeColor(n) {
        let color = 'black';
        if (n.obj) {
            switch (n.obj.type) {
                case 'AST':
                    color = 'blue';
                    break;
                case 'CFG':
                    color = 'red';
                    break;
                case 'PDG':
                    color = 'darkgreen';
                    break;
            }
        }

        return color;
    }

    output(graph, options, filename) {
        this.show_code = options.show_code || false;
        const g_dot = graphviz.digraph('G');

        const nodes_to_print = Object.keys(graph.startNodes)
            .filter(type => !options.ignore.includes(type))
            .map(type => graph.startNodes[type]).flat();
        const nodes_visited = [];

        while (nodes_to_print.length > 0) {
            // console.log(nodes_to_print);
            // console.log(nodes_visited);
            let n = nodes_to_print.shift();

            if (nodes_visited.includes(n.id)) {
                continue;
            }

            if (options.ignore && options.ignore.includes(n.obj.type)) {
                continue;
            }

            nodes_visited.push(n.id);
            let edges = n.edges;

            if (options.ignore) {
                edges = n.edges.filter(e => !options.ignore.includes(e.type));
            }

            const label = this.getNodeLabel(n);
            const color = this.getNodeColor(n);
            g_dot.addNode(label, {fontcolor: color, color: color });

            if (this.show_code && n.type == "ExpressionStatement") {
                //continue;
                edges = n.edges.filter(e => e.type != 'AST');
            }

            if (this.show_code && n.type == "VariableDeclarator") {
                const init = n.obj.init;

                if (init && init.type != "FunctionExpression") {
                    // continue;
                    edges = n.edges.filter(e => e.type != 'AST');
                }
            }

            edges.forEach(e => {
                let [n1, n2] = e.nodes;
                nodes_to_print.push(n2);

                const label = this.getEdgeLabel(e);

                if (!options.ignore.includes(e.type)) {
                    const color = this.getEdgeColor(e);
                    // if (e.type == "PDG") {
                    //     g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { dir: "both", label: label, fontcolor: color, color: color });
                    // } else {
                    //     g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { label: label, fontcolor: color, color: color });
                    // }
                    g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { label: label, fontcolor: color, color: color });
                }
            });
        }

        // console.log(g_dot.to_dot());
        g_dot.output("svg", `${filename}.svg`);
    }
}

module.exports = {
    DotOutput,
};