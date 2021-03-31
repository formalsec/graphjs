const graphviz = require('graphviz');

module.exports = outputGraph;

function outputGraph(graphs) {
    graphs.forEach((g) => {
        const { nodes, edges } = g;
        const dot_nodes = {}; 

        const g_dot = graphviz.digraph("G");

        Object.keys(nodes).forEach((node_id) => {
            const n_name = nodes[node_id].loc ? `${nodes[node_id].type} (${nodes[node_id].loc})` : `${nodes[node_id].type}`;
            dot_nodes[node_id] = g_dot.addNode(n_name);
        });

        edges.forEach((e)=>{
            const start = e.edge[0];
            const end   = e.edge[1];

            if (e.label) {
                g_dot.addEdge(dot_nodes[start], dot_nodes[end], { label: e.label });
            } else {
                g_dot.addEdge(dot_nodes[start], dot_nodes[end]);
            }            
        });

        console.log(g_dot.to_dot());
        g_dot.output("png", "test01.png");
    });
}