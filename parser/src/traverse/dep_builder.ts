// eslint-disable-next-line no-unused-vars
import { getNextObjectName, printJSON } from "../utils/utils";
import { Graph } from "./graph/graph";
import { GraphEdge } from "./graph/edge";
import { GraphNode } from "./graph/node";
import { Identifier, Node, Property } from "estree";

interface RoEntry {
    dep: number,
    type?: string, // "CONST" | "VAR" | "OBJ"
    name?: string,
};

interface DepObjEntry {
    id: number,
    contexts: string[],
};

type VarNamespace = Map<string, object>;
type RoTable = Map<number, RoEntry[]>;
type DepObj = Map<string, DepObjEntry[]>;

function printAuxiliaryStructures(varNamespace: VarNamespace, roTable: RoTable, depObjs: DepObj) {
    if (Object.keys(varNamespace).length > 0) {
        console.log("=============\n VAR context\n=============");
        console.log(varNamespace);
    }

    if (Object.keys(roTable).length > 0) {
        console.log("==========\n RO table\n==========");
        Object.keys(roTable).forEach((k) => console.log(k, " - ", roTable.get(Number(k))));
    }

    if (Object.keys(depObjs).length > 0) {
        console.log("====================\n OBJECT DEPENDENCY table\n====================");
        Object.keys(depObjs).forEach((k) => console.log(k, " - ", depObjs.get(k)));
    }
}

export function buildPDG(cfgGraph: Graph) {
    const graph = cfgGraph;
    const startNodes = graph.startNodes.CFG;

    const varNamespace: VarNamespace = new Map();
    const roTable: RoTable = new Map(); // this holds dependencies for each statement (by id)
    const depObjs: DepObj = new Map();
    const visitedNodes: number[] = [];

    const intraContextStack: string[] = [];

    function getVariableIdOfNamespace(name: string, currentNamespace: string) {
        if (name === undefined) return null;

        const current = varNamespace.get(currentNamespace);
        const global = varNamespace.get("global");

        try {
            const result = current && Object.keys(current).includes(name) ? current[name] : global[name];
            return result;
        } catch (TypeError) {
        // throw new Error(`Failed to find ${name} in namespaces ${currentNamespace} or global.`);
            return null;
        }
    }

    function addVariableToNamespace(name: string, nodeId: number, currentNamespace: string) {
        if (!Object.prototype.hasOwnProperty.call(varNamespace, currentNamespace)) {
            varNamespace.set(currentNamespace, {});
        }
        const current = varNamespace.get(currentNamespace);
        current[name] = nodeId;
    }

    function createObjectDependencyNode(name: string) {
        const objCreateName = getNextObjectName();
        const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
        nodeObj.identifier = objCreateName;
        nodeObj.variableName = name;

        graph.addStartNodes("PDG", nodeObj);
        return nodeObj;
    }

    function addObjectToDependencies(name: string, nodeObj: GraphNode, otherContext: string[] | null) {
        let entry: DepObjEntry;
        if (otherContext) entry = { id: nodeObj.id, contexts: otherContext.slice() };
        else entry = { id: nodeObj.id, contexts: intraContextStack.slice() };

        if (Object.prototype.hasOwnProperty.call(depObjs, name)) {
            const nameDepObj = depObjs.get(name);
            if (nameDepObj) nameDepObj.push(entry); // should always occur
        } else {
            depObjs.set(name, [entry]);
        }
    }

    function createObjDepEdge(stmtNode: GraphNode, nodeObj: GraphNode, depType: string, name: string | null) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "PDG", label: depType, objName: name });
        } else {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "PDG", label: depType });
        }
        return edge;
    }

    function createObjectEdge(stmtNode: GraphNode, nodeObj: GraphNode, depType: any, name: string | null) {
        let edge;
        if (name) {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "OBJECT", label: depType, objName: name });
        } else {
            edge = graph.addEdge(stmtNode.id, nodeObj.id, { type: "OBJECT", label: depType });
        }
        return edge;
    }

    function createNewObjectVersion(olderVersion: GraphNode) {
        const originalName = olderVersion.variableName;

        if (originalName) {
            const newObjVersion = createObjectDependencyNode(originalName);
            addObjectToDependencies(originalName, newObjVersion, null);
            createObjectEdge(olderVersion, newObjVersion, "NEW_VERSION", null);
            return newObjVersion;
        }
    }

    function addRoEntry(nodeId: number, entry: RoEntry) {
        if (Object.prototype.hasOwnProperty.call(roTable, nodeId)) {
            const nodeEntry = roTable.get(nodeId);
            if (nodeEntry) {
                const sameEntry = nodeEntry.filter((e) => e.dep === entry.dep);
                if (sameEntry.length === 0) nodeEntry.push(entry);
            }
        } else {
            roTable.set(nodeId, [entry]);
        }
    }

    function addLiteralDependencyRo(parentId: number, expressionId: number) {
        const roEntry = { dep: expressionId, type: "CONST" };
        addRoEntry(parentId, roEntry);
    }

    function addReturnDependencyRo(parentId: number, expressionId: number) {
        const roEntry = { dep: expressionId, type: "VAR" };
        addRoEntry(parentId, roEntry);
    }

    function addObjectDependencyRo(parentId: number, expressionId: number, name: string) {
        const roEntry = { dep: expressionId, type: "OBJ", name };
        addRoEntry(parentId, roEntry);
    }

    function addIdentifierDependencyRo(parent: GraphNode, depName: string, currentNamespace: string) {
        const depIdentifier = getVariableIdOfNamespace(depName, currentNamespace);
        if (!depIdentifier) return;

        const roEntry: RoEntry = {
            dep: depIdentifier,
            name: depName,
        };

        if (Object.prototype.hasOwnProperty.call(roTable, depIdentifier)) {
            const nodeEntry = roTable.get(depIdentifier);
            if (nodeEntry) {
                const vars = nodeEntry.filter((ro) => ro.type === "VAR" || ro.type === "OBJ");
                if (vars.length > 0) {
                    roEntry.type = "VAR";
                } else {
                    roEntry.type = "CONST";
                }
                addRoEntry(parent.id, roEntry);
                const variable = graph.nodes.get(depIdentifier);
                if (variable) createObjDepEdge(variable, parent, roEntry.type, null);
            }
        }
        // else {
        //     throw new Error(`${depName} with id ${depIdentifier} is not in roTable.`);
        //     // unless maybe it is a function param
        //     // and node types not implemented yet
        // }
    }

    function getLeftAndRight(expr: GraphNode) {
        const left = expr.edges.filter((e) => e.type === "AST" && e.label === "left")[0].nodes[1];
        const right = expr.edges.filter((e) => e.type === "AST" && e.label === "right")[0].nodes[1];
        return { left, right };
    }

    function handleMemberExpresion(parent: GraphNode, node: GraphNode, depType: string, currentNamespace: string) {
        const objName = node.obj.object.name;
        const propertyName = node.obj.property.name;

        const depIdentifier = getVariableIdOfNamespace(objName, currentNamespace);
        if (Object.prototype.hasOwnProperty.call(roTable, depIdentifier)) {
            const nodeEntry = roTable.get(depIdentifier);
            if (nodeEntry) {
                const vars = nodeEntry.filter((ro) => ro.type === "OBJ" && ro.name === objName);
                vars.forEach((v) => {
                    if (Object.prototype.hasOwnProperty.call(depObjs, v.name)) {
                        if (depType === "WRITE") {
                            // get latest object version node
                            const nodeId = depObjs[v.name].slice(-1)[0].id;
                            const nodeObj = graph.nodes.get(nodeId);

                            if (nodeObj) {
                                // create new version
                                const newObjVersion = createNewObjectVersion(nodeObj);

                                if (newObjVersion) {
                                    // link new version to previous version
                                    createObjDepEdge(parent, newObjVersion, depType, propertyName);
                                }
                            }
                        } else if (depType === "LOOKUP") {
                            // search all object version in the context
                            const currentContext = intraContextStack.slice(-1)[0];
                            const nodeIds = depObjs[v.name].filter(
                                (version: DepObjEntry) => version.contexts.includes(currentContext),
                            );
                            nodeIds.forEach(
                                (nodeObj: GraphNode) => createObjDepEdge(nodeObj, parent, depType, propertyName),
                            );
                        } else {
                            throw new Error(`Dependency type should be LOOKUP or WRITE, instead ${depType} was supplied.`);
                        }
                    }
                });
                addObjectDependencyRo(parent.id, node.id, objName);
            }
        }
    }

    function handleExpressionDependencies(parent: GraphNode, expr: GraphNode, currentNamespace: string) {
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
                (prop: Property) => handleExpressionDependencies(expr, prop, currentNamespace),
            );
            const { name } = parent.obj.id;
            const nodeObj = createObjectDependencyNode(name);
            addObjectToDependencies(name, nodeObj, null);
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
            expr.obj.params.forEach((p: Identifier) => {
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

    function traverse(node: GraphNode, currentNamespace: string | null): Graph | undefined {
        if (node === null) {
            return;
        }

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        switch (node.type) {
        case "CFG_F_START": {
            if (node.namespace) intraContextStack.push(node.namespace);
            break;
        }

        case "IfStatement": {
            intraContextStack.push(node.id.toString());
            break;
        }

        case "CFG_F_END":
        case "CFG_IF_END": {
            intraContextStack.pop();
            break;
        }

        case "FunctionDeclaration": {
            node.obj.params.forEach((p: Identifier) => {
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

            const initEdge = node.edges.filter((e: GraphEdge) => e.type === "AST" && e.label === "init");
            const init = initEdge.length > 0 ? initEdge[0].nodes[1] : null;

            if (init) {
                handleExpressionDependencies(node, init, currentNamespace);
            }
            break;
        }

        case "ExpressionStatement": {
            const expr = node.edges.filter((e: GraphEdge) => e.type === "AST" && e.label === "expression")[0].nodes[1];
            if (expr) {
                handleExpressionDependencies(node, expr, currentNamespace);
            }
            break;
        }

        default:
            break;
        }

        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                traverse(n, currentNamespace);
            });
    }

    startNodes.forEach((node: GraphNode) => {
        traverse(node, node.namespace);
    });

    printAuxiliaryStructures(varNamespace, roTable, depObjs);

    return graph;
}
