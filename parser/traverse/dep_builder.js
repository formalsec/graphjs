const { Graph } = require('./graph');

function buildPDG(cfg_graph) {
    const graph = cfg_graph;
    const start_nodes = graph.start_nodes['CFG'];
    
    const var_namespace = {};
    const ro_table = {}; // this holds dependencies for each statement (by id)
    
    start_nodes.forEach(node => {
        const current_namespace = node.type == "_main_start" ? "global" : node.type;
        traverse(node, current_namespace);
    });

    console.log("=============\n VAR context\n=============")
    console.table(var_namespace);

    console.log("==========\n RO table\n==========");
    Object.keys(ro_table).forEach(k => console.log(k, " - ", ro_table[k]));
    return graph;

    function getVariableIdOfNamespace(name, current_namespace) {

        if (name == "undefined") return null;

        const current = var_namespace[current_namespace];
        const global = var_namespace["global"];

        return Object.keys(current).includes(name) ? current[name] : global[name];
    }

    function addVariableToNamespace(name, node_id, current_namespace) {
        if (!var_namespace.hasOwnProperty(current_namespace)) {
            var_namespace[current_namespace] = {};
        }
        const current = var_namespace[current_namespace]
        current[name] = node_id;
    }

    function traverse(node, current_namespace) {
        if (node === null) {
            return;
        }

        switch (node.type) {
            case "VariableDeclarator": {
                const name = node.obj.id.name;
                addVariableToNamespace(name, node.id, current_namespace);

                const init_edge = node.edges.filter(e => e.type == "AST" && e.label == "init");
                const init = init_edge.length > 0 ? init_edge[0].nodes[1] : null;
                
                if (init) {
                    const deps = getExpressionDependencies(init, current_namespace);
                    addDepencyEdge(deps);
                    ro_table[node.id] = deps;
                }


                node.edges.filter(edge => edge.type == "CFG").forEach(edge => {
                    const n = edge.nodes[1];
                    traverse(n, current_namespace);
                });
                break;
            }

            case "ExpressionStatement": {
                const expr = node.edges.filter(e => e.type == "AST" && e.label == "expression")[0].nodes[1];
                if (expr) {
                    const deps = getExpressionDependencies(expr, current_namespace);
                    addDepencyEdge(deps);
                    ro_table[node.id] = deps;
                }
            }

            default:
                node.edges.filter(edge => edge.type == "CFG").forEach(edge => {
                    const n = edge.nodes[1];
                    traverse(n, current_namespace);
                });
        }

        function addDepencyEdge(deps) {
            deps.forEach(dep_obj => {
                const { dep, type, name } = dep_obj;
                if (type == "VAR") {
                    graph.addEdge(dep, node.id, { type: 'PDG', label: name });
                }
            });
        }
    }

    function getExpressionDependencies(expr, current_namespace) {
        switch (expr.type) {
            case "Literal": {
                return [
                    {
                        dep: expr.id,
                        type: "CONST",
                    }
                ];
            }

            case "Identifier": {
                const variable_id = getVariableIdOfNamespace(expr.obj.name, current_namespace);
                if (variable_id) {
                    return [
                        {
                            dep: variable_id,
                            type: "VAR",
                            name: expr.obj.name
                        }
                    ];
                }
            }

            case "BinaryExpression": {
                // our normalization makes sure that binary expressions only have 
                // identifiers or literals as children
                const left = expr.edges.filter(e => e.type == "AST" && e.label == "left")[0].nodes[1];
                const right = expr.edges.filter(e => e.type == "AST" && e.label == "right")[0].nodes[1];
                
                const deps = [];
                
                if (left.type == "Literal") {
                    deps.push({
                        dep: left.id,
                        type: "CONST",
                    });
                } else {
                    // console.log(left);
                    const left_id = getVariableIdOfNamespace(left.obj.name, current_namespace);
                    if (left_id) {
                        deps.push({
                            dep: left_id,
                            type: "VAR",
                            name: left.obj.name
                        });
                    }
                }

                if (right.type == "Literal") {
                    deps.push({
                        dep: right.id,
                        type: "CONST",
                    });
                } else {
                    const right_id = getVariableIdOfNamespace(right.obj.name, current_namespace);
                    if (right_id) {
                        deps.push({
                            dep: right_id,
                            type: "VAR",
                            name: right.obj.name
                        });
                    }
                }

                return deps;
            }

            case "AssignmentExpression": {
                // our normalization makes sure that assignment expressions only have 
                // identifiers or literals as children
                const right = expr.edges.filter(e => e.type == "AST" && e.label == "right")[0].nodes[1];
                
                const deps = [];
                
                if (right.type == "Literal") {
                    deps.push({
                        dep: right.id,
                        type: "CONST",
                    });
                } else {
                    const right_id = getVariableIdOfNamespace(right.obj.name, current_namespace);
                    deps.push({
                        dep: right_id,
                        type: "VAR",
                        name: right.obj.name
                    });
                }

                return deps;
            }

            default:
                return [];
        }
    }
}


module.exports = { buildPDG };