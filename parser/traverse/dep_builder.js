// eslint-disable-next-line no-unused-vars
const { getNextObjectName, printJSON } = require("../utils/utils");

function printAuxiliaryStructures(varNamespace, roTable, depObjs) {
    if (Object.keys(varNamespace).length > 0) {
        console.log("=============\n VAR context\n=============");
        console.log(varNamespace);
    }

    if (Object.keys(roTable).length > 0) {
        console.log("==========\n RO table\n==========");
        Object.keys(roTable).forEach((k) => console.log(k, " - ", roTable[k]));
    }

    if (Object.keys(depObjs).length > 0) {
        console.log("====================\n OBJECT DEPENDENCY table\n====================");
        Object.keys(depObjs).forEach((k) => console.log(k, " - ", depObjs[k]));
    }
}

function buildPDG(cfgGraph) {
    const graph = cfgGraph;
    const startNodes = graph.startNodes.CFG;

    const varNamespace = {};
    const roTable = {}; // this holds dependencies for each statement (by id)
    const depObjs = {};
    const visitedNodes = [];

    const intraContextStack = [];

    function getVariableIdOfNamespace(name, currentNamespace) {
        if (name === undefined) return null;

        const current = varNamespace[currentNamespace];
        const { global } = varNamespace;

        try {
            const result = Object.keys(current).includes(name) ? current[name] : global[name];
            return result;
        } catch (TypeError) {
        // throw new Error(`Failed to find ${name} in namespaces ${currentNamespace} or global.`);
            return null;
        }
    }

    function addVariableToNamespace(name, nodeId, currentNamespace) {
        if (!Object.prototype.hasOwnProperty.call(varNamespace, currentNamespace)) {
            varNamespace[currentNamespace] = {};
        }
        const current = varNamespace[currentNamespace];
        current[name] = nodeId;
    }

    function createObjectDependencyNode(name) {
        const objCreateName = getNextObjectName();
        const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
        nodeObj.identifier = objCreateName;
        nodeObj.variable_name = name;

        graph.addStartNodes("PDG", nodeObj);
        return nodeObj;
    }

    function addObjectToDependencies(name, nodeObj, otherContext) {
        let entry;
        if (otherContext) entry = { id: nodeObj.id, contexts: otherContext.slice() };
        else entry = { id: nodeObj.id, contexts: intraContextStack.slice() };

        if (Object.prototype.hasOwnProperty.call(depObjs, name)) {
            depObjs[name].push(entry);
        } else {
            depObjs[name] = [entry];
        }
    }

    function createObjDepEdge(stmtNode, nodeObj, depType, name) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "PDG", label: depType, objName: name });
        } else {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "PDG", label: depType });
        }
        return edge;
    }

    function createObjectEdge(stmtNode, nodeObj, depType, name) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "OBJECT", label: depType, objName: name });
        } else {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "OBJECT", label: depType });
        }
        return edge;
    }

    function createNewObjectVersion(olderVersion) {
        const originalName = olderVersion.variable_name;
        const newObjVersion = createObjectDependencyNode(originalName);
        addObjectToDependencies(originalName, newObjVersion);
        createObjectEdge(olderVersion, newObjVersion, "NEW_VERSION");
        return newObjVersion;
    }

    function addRoEntry(nodeId, entry) {
        if (Object.prototype.hasOwnProperty.call(roTable, nodeId)) {
            const sameEntry = roTable[nodeId].filter((e) => e.dep === entry.dep);
            if (sameEntry.length === 0) roTable[nodeId].push(entry);
        } else {
            roTable[nodeId] = [entry];
        }
    }

    function addLiteralDependencyRo(parentId, expressionId) {
        const roEntry = { dep: expressionId, type: "CONST" };
        addRoEntry(parentId, roEntry);
    }

    function addReturnDependencyRo(parentId, expressionId) {
        const roEntry = { dep: expressionId, type: "VAR" };
        addRoEntry(parentId, roEntry);
    }

    function addObjectDependencyRo(parentId, expressionId, name) {
        const roEntry = { dep: expressionId, type: "OBJ", name };
        addRoEntry(parentId, roEntry);
    }

    function addIdentifierDependencyRo(parent, depName, currentNamespace) {
        const depIdentifier = getVariableIdOfNamespace(depName, currentNamespace);
        if (!depIdentifier) return;

        const roEntry = {
            dep: depIdentifier,
            name: depName,
        };

        if (Object.prototype.hasOwnProperty.call(roTable, depIdentifier)) {
            const vars = roTable[depIdentifier].filter((ro) => ro.type === "VAR" || ro.type === "OBJ");
            if (vars.length > 0) {
                roEntry.type = "VAR";
            } else {
                roEntry.type = "CONST";
            }
            addRoEntry(parent.id, roEntry);
            const variable = graph.nodes.get(depIdentifier);
            createObjDepEdge(variable, parent, roEntry.type);
        }
        // else {
        //     throw new Error(`${depName} with id ${depIdentifier} is not in roTable.`);
        //     // unless maybe it is a function param
        //     // and node types not implemented yet
        // }
    }

    function getLeftAndRight(expr) {
        const left = expr.edges.filter((e) => e.type === "AST" && e.label === "left")[0].nodes[1];
        const right = expr.edges.filter((e) => e.type === "AST" && e.label === "right")[0].nodes[1];
        return { left, right };
    }

    function handleMemberExpresion(parent, node, depType, currentNamespace) {
        const objName = node.obj.object.name;
        const propertyName = node.obj.property.name;

        const depIdentifier = getVariableIdOfNamespace(objName, currentNamespace);
        if (Object.prototype.hasOwnProperty.call(roTable, depIdentifier)) {
            const vars = roTable[depIdentifier].filter((ro) => ro.type === "OBJ" && ro.name === objName);
            vars.forEach((v) => {
                if (Object.prototype.hasOwnProperty.call(depObjs, v.name)) {
                    if (depType === "WRITE") {
                        // get latest object version node
                        const nodeId = depObjs[v.name].slice(-1)[0].id;
                        const nodeObj = graph.nodes.get(nodeId);

                        // create new version
                        const newObjVersion = createNewObjectVersion(nodeObj);

                        // link new version to previous version
                        createObjDepEdge(parent, newObjVersion, depType, propertyName);
                    } else if (depType === "LOOKUP") {
                        // search all object version in the context
                        const currentContext = intraContextStack.slice(-1)[0];
                        const nodeIds = depObjs[v.name].filter(
                            (version) => version.contexts.includes(currentContext),
                        );
                        nodeIds.forEach(
                            (nodeObj) => createObjDepEdge(nodeObj, parent, depType, propertyName),
                        );
                    } else {
                        throw new Error(`Dependency type should be LOOKUP or WRITE, instead ${depType} was supplied.`);
                    }
                }
            });
            addObjectDependencyRo(parent.id, node.id, objName);
        }
    }

    function handleExpressionDependencies(parent, expr, currentNamespace) {
        switch (expr.type) {
        case "Literal": {
            addLiteralDependencyRo(parent.id, expr.id);
            break;
        }

        case "Identifier": {
            addIdentifierDependencyRo(parent, expr.obj.name, currentNamespace);
            break;
        }

        case "ObjectExpression": {
            expr.obj.properties.forEach(
                (prop) => handleExpressionDependencies(expr, prop, currentNamespace),
            );
            const { name } = parent.obj.id;
            const nodeObj = createObjectDependencyNode(name);
            addObjectToDependencies(name, nodeObj);
            createObjectEdge(parent, nodeObj, "CREATE", name);
            addObjectDependencyRo(parent.id, expr.id, name);
            break;
        }

        case "Property": {
            // console.log(expr);
            break;
        }

        case "LogicalExpression":
        case "BinaryExpression": {
            // our normalization makes sure that binary expressions only have 2 types of variables:
            // identifiers or literals on the right
            const { left, right } = getLeftAndRight(expr);
            const identifiers = [left, right].filter((el) => el.type === "Identifier");

            // only literals
            if (identifiers.length === 0) {
                addLiteralDependencyRo(parent.id, expr.id);
            } else { // some identifier (var)
                identifiers.forEach((el) => {
                    addIdentifierDependencyRo(parent, el.obj.name, currentNamespace);
                });
            }
            break;
        }

        case "AssignmentExpression": {
            // our normalization guarantees assignment expressions only have 3 types of variables:
            // identifiers, literals or callexpressions on the right
            // and member expressions on the left (writes to object properties)
            const { left, right } = getLeftAndRight(expr);

            if (right.type === "Literal") {
                addLiteralDependencyRo(parent.id, expr.id);
            } else if (right.type === "Identifier") {
                addIdentifierDependencyRo(parent, right.obj.name, currentNamespace);
            }

            if (left.type === "MemberExpression") {
                handleMemberExpresion(parent, left, "WRITE", currentNamespace);
            }
            break;
        }

        case "MemberExpression": {
            // We want to restrict to handling lookups here and not var dependencies for the object
            handleMemberExpresion(parent, expr, "LOOKUP", currentNamespace);
            break;
        }

        case "FunctionExpression":
        case "ArrowFunctionExpression": {
            expr.obj.params.forEach((p) => {
                const { name } = p;
                addVariableToNamespace(name, parent.id, expr.namespace);
                const nodeObj = createObjectDependencyNode(name);
                addObjectToDependencies(name, nodeObj, [expr.namespace]);
                createObjectEdge(parent, nodeObj, "CREATE", name);
                addObjectDependencyRo(parent.id, nodeObj.id, name);
            });
            addReturnDependencyRo(parent.id, expr.id);
            break;
        }

        case "UnaryExpression": {
            // our normalization makes sure that unary expressions only have 2 types of variables:
            // identifiers or literals on the right
            const arg = expr.obj.argument;
            if (arg.type === "Literal") {
                addLiteralDependencyRo(parent.id, expr.id);
            } else {
                addIdentifierDependencyRo(parent, arg.name, currentNamespace);
            }
            break;
        }

        case "CallExpression": {
            const { callee } = expr.obj;
            if (callee) {
                addIdentifierDependencyRo(parent, callee.name, currentNamespace);
            }

            const args = expr.obj.arguments;
            args.forEach((arg) => {
                if (arg.type === "Identifier") {
                    addIdentifierDependencyRo(parent, arg.name, currentNamespace);
                }
            });
            addReturnDependencyRo(parent.id, expr.id);

            // if the function return might be a usable object
            if (parent.type !== "ExpressionStatement") {
                const name = parent.identifier;
                const nodeObj = createObjectDependencyNode(name);
                addObjectToDependencies(name, nodeObj, [currentNamespace]);
                createObjectEdge(parent, nodeObj, "CREATE", name);
                addObjectDependencyRo(parent.id, nodeObj.id, name);
            }
            break;
        }

        default:
            //  throw new Error(`Oops, this is not implemented for ${expr.type} nodes`);
        }
    }

    function traverse(node, currentNamespace) {
        if (node === null) {
            return;
        }

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        switch (node.type) {
        case "CFG_F_START": {
            intraContextStack.push(node.namespace);
            break;
        }

        case "IfStatement": {
            intraContextStack.push(node.id);
            break;
        }

        case "CFG_F_END":
        case "CFG_IF_END": {
            intraContextStack.pop();
            break;
        }

        case "FunctionDeclaration": {
            node.obj.params.forEach((p) => {
                const { name } = p;
                addVariableToNamespace(name, node.id, node.namespace);
                const nodeObj = createObjectDependencyNode(name);
                addObjectToDependencies(name, nodeObj, [node.namespace]);
                createObjectEdge(node, nodeObj, "CREATE", name);
                addObjectDependencyRo(node.id, nodeObj.id, name);
            });
            break;
        }

        case "Identifier": {
            addIdentifierDependencyRo(node, node.obj.name, currentNamespace);
            break;
        }

        case "VariableDeclarator": {
            const { name } = node.obj.id;
            // eslint-disable-next-line no-param-reassign
            node.identifier = name;
            addVariableToNamespace(name, node.id, currentNamespace);

            const initEdge = node.edges.filter((e) => e.type === "AST" && e.label === "init");
            const init = initEdge.length > 0 ? initEdge[0].nodes[1] : null;

            if (init) {
                handleExpressionDependencies(node, init, currentNamespace);
            }
            break;
        }

        case "ExpressionStatement": {
            const expr = node.edges.filter((e) => e.type === "AST" && e.label === "expression")[0].nodes[1];
            if (expr) {
                handleExpressionDependencies(node, expr, currentNamespace);
            }
            break;
        }

        default:
            break;
        }

        node.edges.filter((edge) => edge.type === "CFG").forEach((edge) => {
            const n = edge.nodes[1];
            traverse(n, currentNamespace);
        });
    }

    startNodes.forEach((node) => {
        traverse(node, node.namespace);
    });

    printAuxiliaryStructures(varNamespace, roTable, depObjs);

    return graph;
}

module.exports = { buildPDG };
