const { Graph } = require('./graph');
const { getNextObjectName } = require('../utils/utils');

function buildPDG(cfg_graph) {
    const graph = cfg_graph;
    const start_nodes = graph.start_nodes['CFG'];
    
    const var_namespace = {};
    const ro_table = {}; // this holds dependencies for each statement (by id)
    const dep_objs = {};
    const visited_nodes = [];

    const intra_context_stack = [];
    
    start_nodes.forEach(node => {
        const current_namespace = node.namespace == "_main" ? "global" : node.namespace;
        traverse(node, current_namespace);
    });

    printAuxiliaryStructures();

    return graph;

    function printAuxiliaryStructures() {
        if (Object.keys(var_namespace).length > 0) {
            console.log("=============\n VAR context\n=============");
            console.table(var_namespace);
        }

        if (Object.keys(ro_table).length > 0) {
            console.log("==========\n RO table\n==========");
            Object.keys(ro_table).forEach(k => console.log(k, " - ", ro_table[k]));
        }

        if (Object.keys(dep_objs).length > 0) {
            console.log("====================\n OBJECT DEPENDENCY table\n====================");
            Object.keys(dep_objs).forEach(k => console.log(k, " - ", dep_objs[k]));
        }
    }

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
        const node_obj = graph.addNode('PDG_OBJECT', { type: 'PDG' });
        node_obj.identifier = obj_create_name;
        node_obj.variable_name = name;

        graph.add_start_nodes('PDG', node_obj);
        return node_obj;
    }

    function addObjectToDependencies(name, node_obj, other_context) {
        let entry;
        if (other_context) entry = { id: node_obj.id, contexts: other_context.slice() } 
        else entry = { id: node_obj.id, contexts: intra_context_stack.slice() };
        
        if (dep_objs.hasOwnProperty(name)) {
            dep_objs[name].push(entry);
        } else {
            dep_objs[name] = [ entry ];
        }
    }

    function createNewObjectVersion(older_version) {
        const original_name = older_version.variable_name;
        const new_obj_version = createObjectDependencyNode(original_name);
        addObjectToDependencies(original_name, new_obj_version);
        createObjectEdge(older_version, new_obj_version, "NEW_VERSION");

        return new_obj_version;
    }

    function createObjectDependencyEdge(stmt_node, node_obj, dep_type, name) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'PDG', label: dep_type, obj_name: name }); 
        } else {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'PDG', label: dep_type });
        }
        return edge;
    }

    function createObjectEdge(stmt_node, node_obj, dep_type, name) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'OBJECT', label: dep_type, obj_name: name }); 
        } else {
            edge = graph.addEdge(stmt_node.id, node_obj.id, { type: 'OBJECT', label: dep_type });
        }
        return edge;
    }

    function addRoEntry(node_id, entry) {
        if (ro_table.hasOwnProperty(node_id)) {
            const same_entry = ro_table[node_id].filter(e => e.dep == entry.dep);
            if (same_entry.length == 0) ro_table[node_id].push(entry);
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
            createObjectDependencyEdge(variable, parent, ro_entry.type);
        } else {
            throw new Error(`${dep_name} with id ${dep_identifier} is not in ro_table.`);
            // unless maybe it is a function param
            // and node types not implemented yet
        }
    }

    function traverse(node, current_namespace) {
        if (node === null) {
            return;
        }

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visited_nodes.includes(node.id)) return;
        visited_nodes.push(node.id);

        switch (node.type) {
            case "CFG_F_START": {
                intra_context_stack.push(node.namespace);
                break;
            }

            case "IfStatement": {
                intra_context_stack.push(node.id);
                break;
            }

            case "CFG_F_END":
            case "CFG_IF_END": {
                intra_context_stack.pop();
                break;
            }

            case "FunctionDeclaration": {
                node.obj.params.forEach(p => {
                    const name = p.name;
                    addVariableToNamespace(name, node.id, node.namespace);
                    const node_obj = createObjectDependencyNode(name);
                    addObjectToDependencies(name, node_obj, [ node.namespace ]);
                    createObjectEdge(node, node_obj, "CREATE", name);
                    addObjectDependencyRo(node.id, node_obj.id, name);
                });
                break;
            }

            case "Identifier": {
                addIdentifierDependencyRo(node, node.obj.name, current_namespace);
                break;
            }

            case "VariableDeclarator": {
                const name = node.obj.id.name;
                node.identifier = name;
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
                addIdentifierDependencyRo(parent, expr.obj.name, current_namespace);
                break;
            }

            case "ObjectExpression": {
                const name = parent.obj.id.name;
                const node_obj = createObjectDependencyNode(name);
                addObjectToDependencies(name, node_obj);
                createObjectEdge(parent, node_obj, "CREATE", name);
                addObjectDependencyRo(parent.id, expr.id, name);
                break;
            }

            case "LogicalExpression":
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
                        addIdentifierDependencyRo(parent, el.obj.name, current_namespace);
                    });
                }
                break;
            }

            case "AssignmentExpression": {
                // our normalization makes sure that assignment expressions only have 2 types of variables:
                // identifiers or literals on the right
                // and member expressions on the left (writes to object properties)
                const { left, right } = getLeftAndRight(expr);

                if (right.type == "Literal") {
                    addLiteralDependencyRo(parent.id, expr.id);
                } else if (right.type == "Identifier") {
                    addIdentifierDependencyRo(parent, right.obj.name, current_namespace);
                }
                
                if (left.type == "MemberExpression") {
                    handleMemberExpresion(parent, left, "WRITE");
                }
                break;
            }

            case "MemberExpression": {
                handleMemberExpresion(parent, expr, "LOOKUP");
                break;
            }

            case "ArrowFunctionExpression": {
                addReturnDependencyRo(parent.id, expr.id);
                break;
            }

            case "UnaryExpression": {
                // our normalization makes sure that unary expressions only have 2 types of variables:
                // identifiers or literals on the right
                const argument = expr.obj.argument;
                if (argument.type == "Literal") {
                    addLiteralDependencyRo(parent.id, expr.id);
                } else {
                    addIdentifierDependencyRo(parent, argument.name, current_namespace);
                }
                break;
            }

            case "CallExpression": {
                const callee = expr.obj.callee;
                if (callee && ro_table.hasOwnProperty(callee.name)) {
                    addIdentifierDependencyRo(parent, callee.name, current_namespace);
                }

                const arguments = expr.obj.arguments;
                arguments.forEach(arg => {
                    addIdentifierDependencyRo(parent, arg.name, current_namespace);
                });
                addReturnDependencyRo(parent.id, expr.id);
                break;
            }

            default:
                throw new Error(`Oops, this is not implemented for ${expr.type} nodes`);
        }

        function handleMemberExpresion(parent, node, dep_type) {
            const obj_name = node.obj.object.name;
            const property_name = node.obj.property.name;

            const dep_identifier = getVariableIdOfNamespace(obj_name, current_namespace);
            if (ro_table.hasOwnProperty(dep_identifier)) {
                const vars = ro_table[dep_identifier].filter(ro => ro.type == "VAR" || ro.type == "OBJ");
                vars.forEach(v => {
                    if (!dep_objs.hasOwnProperty(v.name)) {
                        const node_obj = createObjectDependencyNode(v.name);
                        addObjectToDependencies(v.name, node_obj);
                    } else {
                        if (dep_type == "WRITE") {
                            // get latest object version node
                            const node_id = dep_objs[v.name].slice(-1)[0].id;
                            const node_obj = graph.nodes.get(node_id);

                            // create new version
                            const new_obj_version = createNewObjectVersion(node_obj);
                            
                            // link new version to previous version
                            createObjectDependencyEdge(parent, new_obj_version, dep_type, property_name);
                        } else if (dep_type == "LOOKUP") {
                            // search all object version in the context
                            const current_context = intra_context_stack.slice(-1)[0];
                            const node_ids = dep_objs[v.name].filter(version => version.contexts.includes(current_context));
                            node_ids.forEach(node_obj => createObjectDependencyEdge(node_obj, parent, dep_type, property_name));    
                        } else {
                            throw new Error(`Dependency type should be LOOKUP or WRITE, instead ${dep_type} was supplied.`);
                        }
                    }
                });
                addObjectDependencyRo(parent.id, node.id, obj_name);
            }
        }

        function getLeftAndRight(expr) {
            const left = expr.edges.filter(e => e.type == "AST" && e.label == "left")[0].nodes[1];
            const right = expr.edges.filter(e => e.type == "AST" && e.label == "right")[0].nodes[1];
            return { left, right };
        }
    }
}


module.exports = { buildPDG };