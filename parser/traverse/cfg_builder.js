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

        switch (node.type) {
            //
            // Scripts
            //
            case "Program": {
                const cfg_namespace = 'main';
                // let _start = graph.addNode('_main_start', { type: 'CFG' });
                
                let _start = graph.addNode('CFG_F_START', { type: 'CFG' });
                _start.identifier = 'main';
                _start.namespace = cfg_namespace;
                graph.add_start_nodes('CFG', _start);

                // let _end = graph.addNode('_main_end', { type: 'CFG' });
                let _end = graph.addNode('CFG_F_END', { type: 'CFG' });
                _end.identifier = 'main';

                let previous_node = _start;
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

            // case "BlockStatement": {
            //     // let previous_node = node;
            //     let previous_node = parent_node;
            //     // console.log(node.edges);
            //     console.log(parent_node);

            //     node.edges.forEach(edge => {
            //         const [n, child_node] = edge.nodes;
            //         console.log(previous_node.id);
            //         const { root, exit } = traverse(child_node);
            //         graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
            //         previous_node = exit;
            //     });
                
            //     return {
            //         root: parent_node,
            //         exit: previous_node,
            //     };
            // }

            case "BlockStatement": {
                let previous_node = node.edges[0].nodes[1];
                const first_node = previous_node;

                node.edges.slice(1).forEach(edge => {
                    const [n, child_node] = edge.nodes;
                    const { root, exit } = traverse(child_node);
                    graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
                    previous_node = exit;
                });
                
                return {
                    root: first_node,
                    exit: previous_node,
                };
            }

            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                let name = `${node.id}_${node.identifier}`;
                const cfg_namespace = `_${name}`;

                // let _start = graph.addNode(cfg_namespace, { type: 'CFG' });
                let _start = graph.addNode('CFG_F_START', { type: 'CFG' });
                _start.identifier = name;
                _start.namespace = cfg_namespace;

                graph.add_start_nodes('CFG', _start);
                node.namespace = cfg_namespace;

                // let _end = graph.addNode(`_${name}_end`, { type: 'CFG' });
                let _end = graph.addNode('CFG_F_END', { type: 'CFG' });
                _end.identifier = name;

                const block_edge = node.edges.filter(edge => edge.label == 'block')[0];
                const block_node = block_edge.nodes[1];
                // block_node.edges.forEach(edge => {
                //     const [n, child_node] = edge.nodes;
                //     const { root, exit } = traverse(child_node);
                //     graph.addEdge(previous_node.id, root.id, { type: 'CFG' });
                //     previous_node = exit;
                // });
                const {root, exit } = traverse(block_node);
                graph.addEdge(_start.id, root.id, { type: 'CFG' });
                graph.addEdge(exit.id, _end.id, { type: 'CFG' });
                return {
                    root: node,
                    exit: node,
                };
            }

            case "IfStatement":
            case "ConditionalExpression": {
                let [test, consequent, alternate] = node.edges.map(edge => traverse(edge.nodes[1]));

                // let _end_if = graph.addNode(`_${node.id}_end_if`, { type: 'CFG' });
                let _end_if = graph.addNode('CFG_IF_END', { type: 'CFG' });
                _end_if.identifier = node.id;

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