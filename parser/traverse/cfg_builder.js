function buildCFG(ast_graph) {
    const graph = ast_graph;
    traverse(graph.start_nodes['AST'][0]);
    return graph;

    function defaultNode(node) {
        node.edges.map(edge => traverse(edge.nodes[1]));
        return {
            root: node,
            exit: node,
        };
    };

    function traverse(node) {
        
        if (node === null) {
            return;
        }
              
        let previous_node = null;
        switch (node.type) {
            //
            // Scripts
            //
            case "Program": {
                let _start = graph.addNode('_main_start', { type: 'CFG' });
                graph.add_start_nodes('CFG', _start);

                let _end = graph.addNode('_main_end', { type: 'CFG' });

                previous_node = _start;
                node.edges.forEach(edge => {
                    const [n, child_node] = edge.nodes;
                    const { root, exit } = traverse(child_node);
                    graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
                    previous_node = exit;
                });
                graph.addEdge(previous_node.id, _end.id, { type: 'CFG' });
                return {
                    root: _start,
                    exit: _end,
                };
            }

            case "BlockStatement": {
                previous_node = node;
                node.edges.forEach(edge => {
                    const [n, child_node] = edge.nodes;
                    const { root, exit } = traverse(child_node);
                    graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
                    previous_node = exit;
                });
                
                return {
                    root: node,
                    exit: previous_node,
                };
            }

            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                let name = `${node.id}_${node.identifier}`;
                
                let _start = graph.addNode(`_${name}_start`, { type: 'CFG' });
                graph.add_start_nodes('CFG', _start);
                
                let _end = graph.addNode(`_${name}_end`, { type: 'CFG' });
                
                previous_node = _start;
                node.edges.forEach(edge => {
                    const [n, child_node] = edge.nodes;
                    const { root, exit } = traverse(child_node);
                    graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
                    previous_node = exit;
                });

                // graph.addEdge(_start.id, node_body.root.id, { type: 'CFG' });
                graph.addEdge(previous_node.id, _end.id, { type: 'CFG' });
                return {
                    root: node,
                    exit: node,
                };
            }

            case "IfStatement":
            case "ConditionalExpression": {
                let [test, consequent, alternate] = node.edges.map(edge => traverse(edge.nodes[1]));

                let _end_if = graph.addNode(`_${node.id}_end_if`, { type: 'CFG' });

                graph.addEdge(node.id, test.root.id, { type: 'CFG', label: 'test'});
                graph.addEdge(test.exit.id, consequent.root.id, { type: 'CFG', label: 'TRUE'});
                graph.addEdge(consequent.exit.id, _end_if.id, { type: 'CFG' });

                if (alternate) {
                    graph.addEdge(test.exit.id, alternate.root.id, { type: 'CFG', label: 'FALSE'});
                    graph.addEdge(alternate.exit.id, _end_if.id, { type: 'CFG' });
                } else {
                    graph.addEdge(test.exit.id, _end_if.id, { type: 'CFG', label: 'FALSE'});
                }
                return {
                    root: node,
                    exit: _end_if,
                };
            }
            
            default:
                return defaultNode(node);
        }
    }
}


module.exports = { buildCFG };