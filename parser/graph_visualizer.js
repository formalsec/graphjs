const graphviz = require('graphviz');

module.exports = outputGraph;

function outputGraph(g) {
    const { nodes, edges } = g;
    const dot_nodes = {}; 

    const g_dot = graphviz.digraph("G");

    nodes.forEach((node) => {
        const n_name = node.label ? `${node.type} (${node.label}) $${node.id}` : `${node.type} $${node.id}`;
        dot_nodes[node.id] = g_dot.addNode(n_name);
    });

    edges.forEach((edge)=>{
        const start = edge[0];
        const end   = edge[1];
        const label = (edge.length > 2) ? edge[2] : undefined;

        if (label) {
            g_dot.addEdge(dot_nodes[start], dot_nodes[end], { label });
        } else {
            g_dot.addEdge(dot_nodes[start], dot_nodes[end]);
        }            
    });

    console.log(g_dot.to_dot());
    g_dot.output("png", `graph.png`);
}