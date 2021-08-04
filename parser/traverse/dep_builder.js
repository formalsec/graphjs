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

    function addRoEntry(node_id, entry) {
        if (ro_table.hasOwnProperty(node_id)) {
            ro_table[node_id].push(entry);
        } else {
            ro_table[node_id] = [ entry ];
        }
    }

    function addLiteralDependencyRo(parent_id, expression_id) {
        const ro_entry = { dep: expression_id, type: "CONST" };
        addRoEntry(parent_id, ro_entry);
    }

    function addReturnDependencyRo(parent_id, expression_id) {
        const ro_entry = { dep: expression_id, type: "VAR" };
        addRoEntry(parent_id, ro_entry);
    }

    function addObjectDependencyRo(parent_id, expression_id, name) {
        const ro_entry = { dep: expression_id, type: "OBJ", name };
        addRoEntry(parent_id, ro_entry);
    }

    function addIdentifierDependencyRo(parent, dep_name, current_namespace) {
        const dep_identifier = getVariableIdOfNamespace(dep_name, current_namespace);
        
        const ro_entry = {
            dep: dep_identifier,
            name: dep_name,
        };

        if (ro_table.hasOwnProperty(dep_identifier)) {
            const vars = ro_table[dep_identifier].filter(ro => ro.type == "VAR" || ro.type == "OBJ");
            if (vars.length > 0) {
                ro_entry.type = "VAR";
            } else {
                ro_entry.type = "CONST";
            }
            addRoEntry(parent.id, ro_entry);
            const variable = graph.nodes.get(dep_identifier);
            createObjectDependencyEdge(parent, variable, ro_entry.type);
        } else {
            throw new Error("Shouldn't happen");
            // unless maybe it is a function param
            // and node types not implemented yet
        }
    }

    function traverse(node, current_namespace) {
        if (node === null) {
            return;
        }

        switch (node.type) {
            case "FunctionDeclaration": {
                node.obj.params.forEach(p => {
                    // This is probably not right
                    const name = p.name;
                    
                    local_declared_objs.push(name);
                    addVariableToNamespace(name, node.id, current_namespace);

                    const node_obj = createObjectDependencyNode(name);
                    createObjectDependencyEdge(node, node_obj, "CREATE", name);
                    addObjectDependencyRo(node.id, node_obj.id, name);
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
                    handleExpressionDependencies(node, init, current_namespace);
                }
                break;
            }

            case "ExpressionStatement": {
                const expr = node.edges.filter(e => e.type == "AST" && e.label == "expression")[0].nodes[1];
                if (expr) {
                    handleExpressionDependencies(node, expr, current_namespace);
                }
                break;
            }
        }

        node.edges.filter(edge => edge.type == "CFG").forEach(edge => {
            const n = edge.nodes[1];
            traverse(n, current_namespace);
        });
    }

    function handleExpressionDependencies(parent, expr, current_namespace) {
        switch (expr.type) {

            case "Literal": {
                addLiteralDependencyRo(parent.id, expr.id);
                break;
            }

            case "Identifier": {
                try {
                    addIdentifierDependencyRo(parent, expr.obj.name, current_namespace);
                } catch(e) {
                    console.log(ro_table);
                    console.error("ERROR: ", expr);
                    console.error(e.stack);
                }
                break;
            }

            case "ObjectExpression": {
                const name = parent.obj.id.name;
                const node_obj = createObjectDependencyNode(name);
                createObjectDependencyEdge(parent, node_obj, "CREATE", name);
                addObjectDependencyRo(parent.id, expr.id, name);
                break;
            }

            case "BinaryExpression": {
                // our normalization makes sure that binary expressions only have 2 types of variables:
                // identifiers or literals on the right
                // and member expressions on the left (writes to object properties)
                const { left, right } = getLeftAndRight(expr);
                const identifiers = [left, right].filter(el => el.type == "Identifier");
                
                // only literals
                if (identifiers.length == 0) {
                    addLiteralDependencyRo(parent.id, expr.id);
                } else { // some identifier (var)
                    identifiers.forEach(el => {
                        try {
                            addIdentifierDependencyRo(parent, el.obj.name, current_namespace);
                        } catch(e) {
                            console.log(ro_table);
                            console.error("ERROR: ", expr);
                            console.error(e.stack);
                        }
                    });
                }
                break;
            }

            case "AssignmentExpression": {
                // our normalization makes sure that assignment expressions only have 2 types of variables:
                // identifiers or literals on the right
                // and member expressions on the left (writes to object properties)
                const { left, right } = getLeftAndRight(expr);         
                handleRightSideAssignment(parent, right, current_namespace);
                
                if (left.type == "MemberExpression") {
                    handleMemberExpresion(parent, left, "WRITE");
                }
                break;
            }

            case "MemberExpression": {
                handleMemberExpresion(parent, expr, "LOOKUP");
                break;
            }

            // case "UnaryExpression": {
            //     // our normalization makes sure that unary expressions only have 2 types of variables:
            //     // identifiers or literals on the right
            //     const argument = expr.obj.argument;
            //     if (argument.type == "Literal") {
            //         // ro_table[parent.id] = {
            //         //     dep: expr.id,
            //         //     type: "CONST",
            //         // };
            //     } else {
            //         const obj_name = argument.name;
            //         console.log(obj_name);
            //     }
            //     console.log(expr);
            //     break;
            // }

            case "CallExpression": {
                const arguments = expr.obj.arguments;
                arguments.forEach(arg => {
                    try {
                        addIdentifierDependencyRo(parent, arg.obj.name, current_namespace);
                    } catch(e) {
                        console.log(ro_table);
                        console.error("ERROR: ", expr);
                        console.error(e.stack);
                    }
                });
                addReturnDependencyRo(parent.id, expr.id);
                break;
            }

            default:
                return [];
        }

        function handleMemberExpresion(parent, node, dep_type) {
            const obj_name = node.obj.object.name;
            const property_name = node.obj.property.name;

            const dep_identifier = getVariableIdOfNamespace(obj_name, current_namespace);
            console.log(dep_objs);
            if (ro_table.hasOwnProperty(dep_identifier)) {
                const vars = ro_table[dep_identifier].filter(ro => ro.type == "VAR");
                console.log(vars);
                vars.forEach(v => {
                    let node_obj;
                    if (!dep_objs.hasOwnProperty(v.name)) {
                        node_obj = createObjectDependencyNode(v.name);
                    } else {
                        node_obj = graph.nodes.get(dep_objs[v.name].id);
                        createObjectDependencyEdge(parent, node_obj, dep_type, property_name);
                    }
                    dep_objs[obj_name] = { id: node_obj.id };
                });
                addObjectDependencyRo(parent.id, node.id, obj_name);
            }

            // if (!dep_objs.hasOwnProperty(obj_name)) {
            //     node_obj = createObjectDependencyNode(obj_name);
            // } else {
            //     node_obj = graph.nodes.get(dep_objs[obj_name].id);
            //     createObjectDependencyEdge(parent, node_obj, dep_type, property_name);
            // }
        }

        function getLeftAndRight(expr) {
            const left = expr.edges.filter(e => e.type == "AST" && e.label == "left")[0].nodes[1];
            const right = expr.edges.filter(e => e.type == "AST" && e.label == "right")[0].nodes[1];
            return { left, right };
        }

        function handleRightSideAssignment(parent, right, current_namespace) {
            switch (right.type) {
                case "Literal": {
                    // const ro_entry = { dep: expr.id, type: "CONST" };
                    // addRoEntry(parent.id, ro_entry);
                    break;
                }
    
                case "Identifier": {
                    addIdentifierDependencyRo(parent, right.obj.name, current_namespace);
                    break;
                }
    
                // case "CallExpression": {
                //     console.log(right);
                //     break;
                // }
    
                // case "MemberExpression": {
                //     break;
                // }
            }
        }
    }
}


module.exports = { buildPDG };