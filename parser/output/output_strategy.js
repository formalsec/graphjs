const graphviz = require('graphviz');
const escodegen = require('escodegen');

class OutputManager {

    constructor(options) {
        this._writer = null;
        this._options = options;
    }

    set writer(writer) {
        this._writer = writer;
    }

    get writer() {
        return this._writer;
    }

    get options() {
        return this._options;
    }

    output(graph, filename) {
        this._writer.output(graph, this._options, filename);
    }
}

class DotOutput {
    getNodeLabel(n) {
        let label = `#${n.id} ${n.type}`;
        if (n.obj) {
            switch(n.type) {
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

    // output(graph, options, filename) {
    //     const g_dot = graphviz.digraph('G');

    //     const nodes = graph.nodes;
    //     const edges = graph.edges;

    //     nodes.forEach(n => {
    //         let edges = n.edges;

    //         if (options.ignore) {
    //             edges = n.edges.filter(e => !options.ignore.includes(e.type));
    //         }

    //         if (edges.length > 0) {
    //             const label = this.getNodeLabel(n);
    //             const color = this.getNodeColor(n);
    //             g_dot.addNode(label, {fontcolor: color, color: color });
    //         }
    //     });

    //     edges.forEach(e => {
    //         let [n1, n2] = e.nodes;

    //         const label = e.label;

    //         if (!options.ignore.includes(e.type)) {
    //             const color = this.getEdgeColor(e);
    //             g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { label: label, fontcolor: color, color: color });
    //         }
    //     });

    //     // console.log(g_dot.to_dot());
    //     g_dot.output("svg", `${filename}.svg`);
    // }

    output(graph, options, filename) {
        this.show_code = options.show_code || false;
        const g_dot = graphviz.digraph('G');

        const nodes_to_print = Object.keys(graph.start_nodes)
            .filter(type => !options.ignore.includes(type))
            .map(type => graph.start_nodes[type]).flat();
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
    
                const label = e.label;
    
                if (!options.ignore.includes(e.type)) {
                    const color = this.getEdgeColor(e);
                    if (e.type == "PDG") {
                        g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { dir: "both", label: label, fontcolor: color, color: color });
                    } else {
                        g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { label: label, fontcolor: color, color: color });
                    }
                }
            });
        }

        // console.log(g_dot.to_dot());
        g_dot.output("svg", `${filename}.svg`);
    }
}

module.exports = {
    OutputManager,
    DotOutput
};