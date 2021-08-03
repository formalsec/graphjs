const { Graph } = require('./graph');
const { getNextObjectName } = require('../utils/utils');

function buildPDG(cfg_graph) {
    const graph = cfg_graph;
    const start_nodes = graph.start_nodes['CFG'];
    
    const var_namespace = {};
    const ro_table = {}; // this holds dependencies for each statement (by id)
    const local_declared_objs = [];
    const dep_objs = [];
    
    start_nodes.forEach(node => {
        const current_namespace = node.type == "_main_start" ? "global" : node.type;
        traverse(node, current_namespace);
    });

    console.log("=============\n VAR context\n=============")
    console.table(var_namespace);

    console.log("==========\n RO table\n==========");
    Object.keys(ro_table).forEach(k => console.log(k, " - ", ro_table[k]));

    console.log("====================\n LOCALS table\n====================");
    console.log(local_declared_objs);

    console.log("====================\n OBJECT DEPENDENCY table\n====================");
    Object.keys(dep_objs).forEach(k => console.log(k, " - ", dep_objs[k]));

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

    function createObjectDependencyNode(name) {
        const obj_create_name = getNextObjectName();
        const node_obj = graph.addNode(obj_create_name, { type: 'PDG' });
        graph.add_start_nodes('PDG', node_obj);
        dep_objs[name] = { id: node_obj.id };
        return node_obj;
    }

    function createObjectDependencyEdge(stmt_node, node_obj, dep_type, name) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'PDG', label: `${dep_type} ${name}` }); 
        } else {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'PDG', label: `${dep_type}` });
        }
        return edge;
    }

    function traverse(node, current_namespace) {
        if (node === null) {
            return;
        }

        switch (node.type) {
            case "FunctionDeclaration": {
                node.obj.params.forEach(p => {
                    const name = p.name;
                    const node_obj = createObjectDependencyNode(name);
                    createObjectDependencyEdge(node, node_obj, "CREATE", name);
                });
                break;
            }

            case "VariableDeclarator": {
                const name = node.obj.id.name;
                local_declared_objs.push(name);
                addVariableToNamespace(name, node.id, current_namespace);

                const init_edge = node.edges.filter(e => e.type == "AST" && e.label == "init");
                const init = init_edge.length > 0 ? init_edge[0].nodes[1] : null;
                
                if (init) {
                    createExpressionDependencies(node, init, current_namespace);
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
                    createExpressionDependencies(node, expr, current_namespace);
                }
                break;
            }

            default:
                node.edges.filter(edge => edge.type == "CFG").forEach(edge => {
                    const n = edge.nodes[1];
                    traverse(n, current_namespace);
                });
        }
    }

    function createExpressionDependencies(parent, expr, current_namespace) {
        switch (expr.type) {

            case "AssignmentExpression": {
                // our normalization makes sure that assignment expressions only have 2 types of variables:
                // identifiers or literals on the right
                // and member expressions on the left (writes to object properties)
                const left = expr.edges.filter(e => e.type == "AST" && e.label == "left")[0].nodes[1];
                const right = expr.edges.filter(e => e.type == "AST" && e.label == "right")[0].nodes[1];
                let node_obj;

                if (right.type == "Literal") {
                    // createObjectDependencyEdge(parent, right, "CONST");
                } else if (right.type == "MemberExpression") {
                // } else {
                    // const right_id = getVariableIdOfNamespace(right.obj.name, current_namespace);
                    // const right_node = graph.nodes.get(right_id);
                    // createObjectDependencyEdge(parent, right, "VAR", right.obj.name);
                }

                if (left.type == "MemberExpression") {
                    const obj_name = left.obj.object.name;
                    const property_name = left.obj.property.name;

                    if (!dep_objs.hasOwnProperty(obj_name)) {
                        node_obj = createObjectDependencyNode(obj_name);
                    } else {
                        node_obj = graph.nodes.get(dep_objs[obj_name].id);
                        createObjectDependencyEdge(parent, node_obj, "WRITE", property_name);
                    }
                }
                break;
            }

            case "MemberExpression": {
                const obj_name = expr.obj.object.name;
                const property_name = expr.obj.property.name;

                if (!dep_objs.hasOwnProperty(obj_name)) {
                    node_obj = createObjectDependencyNode(obj_name);
                } else {
                    node_obj = graph.nodes.get(dep_objs[obj_name].id);
                    createObjectDependencyEdge(parent, node_obj, "LOOKUP", property_name);
                }
                break;
            }

            default:
                return [];
        }
    }
}


module.exports = { buildPDG };