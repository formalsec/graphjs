const graphviz = require('graphviz');

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
                case 'Identifier':
                    label = `#${n.id} ${n.type} (${n.obj.name})`;
                    break;

                // case 'Literal':
                //     label = `#${n.id} ${n.type} (${n.obj.raw})`;
                //     break;

                case 'UpdateExpression':
                case 'UnaryExpression':        
                    label = `#${n.id} ${n.type} (${n.obj.operator})`;
                    break;                        
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
            }
        }

        return color;
    }

    output(graph, options, filename) {
        const g_dot = graphviz.digraph('G');

        const nodes = graph.nodes;
        const edges = graph.edges;

        nodes.forEach(n => {
            let edges = n.edges;

            if (options.ignore) {
                edges = n.edges.filter(e => !options.ignore.includes(e.type));
            }

            if (edges.length > 0) {
                const label = this.getNodeLabel(n);
                const color = this.getNodeColor(n);
                g_dot.addNode(label, {fontcolor: color, color: color });
            }
        });

        edges.forEach(e => {
            let [n1, n2] = e.nodes;

            const label = e.label;

            if (!options.ignore.includes(e.type)) {
                const color = this.getEdgeColor(e);
                g_dot.addEdge(this.getNodeLabel(n1), this.getNodeLabel(n2), { label: label, fontcolor: color, color: color });
            }
        });

        console.log(g_dot.to_dot());
        g_dot.output("svg", `${filename}.svg`);
    }
}

module.exports = {
    OutputManager,
    DotOutput
};