import { GraphEdge } from "../graph/edge";
import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto } from "./dependency_trackers";
import { StorageFactory, StorageObject } from "./sto_factory";
import { Identifier } from "estree";

function handleSimpleAssignment(stmtId: number, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;

    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    let storageValue = evalSto(trackers, expNode)[0];

    // if the expression corresponds to an object then
    // we are referencing this object and dont need to
    // create a new one, otherwise we need a new object
    if (!StorageFactory.isStorageObject(storageValue)) {
        newTrackers = createAndStoreNewObjectNode(stmtId, variable, trackers);
    } else {
        // store the identifier of the location
        newTrackers.addToStore(variableName, storageValue);

        // store the stmtid
        newTrackers.addToPhi(variableName, stmtId);
    }


    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleBinaryExpression(stmtId: number, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, BinExpNode);

    newTrackers = createAndStoreNewObjectNode(stmtId, variable, trackers);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleReturnArgument(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function createAndStoreNewObjectNode(stmtId: number, variable: Identifier, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;

    // clone trackers
    const newTrackers = trackers.clone();

    // add to heap
    const pdgObjName = newTrackers.addNewObjectToHeap(variableName);

    // store the identifier of the new object
    newTrackers.addToStore(variableName, StorageFactory.StoObject(pdgObjName));

    // store the stmtid
    newTrackers.addToPhi(variableName, stmtId);

    // set changes as creation of new object
    newTrackers.graphCreateNewObject(stmtId, variableName, pdgObjName);

    return newTrackers;
}

function handleMemberExpression(stmtId: number, variable: Identifier, memExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;

    // get child nodes for the member expression
    const obj = getASTNode(memExpNode, "object");
    const prop = getASTNode(memExpNode, "property");

    const objName = obj.obj.name;
    let propName = prop.obj.name;

    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    let deps = evalDep(newTrackers, stmtId, memExpNode);

    // if there are no dependencies then we have to create
    // the objects corresponding to the properties in the
    // memExpNode and re-run evalDep
    if (deps.length === 0) {
        newTrackers.createObjectProperties(stmtId, objName, propName);
        deps = evalDep(newTrackers, stmtId, memExpNode);
    }

    // check if this expression is already in storage
    // we just check the last value in storage because
    // it is the most recent
    const storageValue = evalSto(trackers, memExpNode).slice(-1)[0];

    if (!StorageFactory.isStorageObject(storageValue)) {
        // if the expression corresponds to an object then
        // we are referencing this object and dont need to
        // create a new one, otherwise we need a new object
        newTrackers = createAndStoreNewObjectNode(stmtId, variable, trackers);
    } else {
        // store the identifier of the location
        newTrackers.addToStore(variableName, storageValue);

        // store the stmtid
        newTrackers.addToPhi(variableName, stmtId);

        const location = (<StorageObject> storageValue).location;
        newTrackers.graphBuildReferenceEdge(stmtId, variableName, location);
    }

    // set changes as lookup from object
    newTrackers.graphLookupObject(deps);

    return newTrackers;
}

function handleArrayExpressionElement(stmtId: number, variable: Identifier, elemNode: GraphNode, elementIndex: number, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;

    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, elemNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, elemNode)[0];

    newTrackers.createArrayElementInHeap(stmtId, variableName, elementIndex, storageValue);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleCallExpression(stmtId: number, variable: Identifier, argNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, argNode);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleArrayExpression(stmtId: number, variable: Identifier, arrExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    newTrackers = createAndStoreNewObjectNode(stmtId, variable, newTrackers);

    const arrElementEdges = getAllASTEdges(arrExpNode, "element");
    arrElementEdges.forEach((edge) => {
        const elementIndex = edge.elementIndex;
        const element = edge.nodes[1];
        newTrackers = handleArrayExpressionElement(stmtId, variable, element, elementIndex, newTrackers);
    });

    // newTrackers.print();
    return newTrackers;
}

function handleIfStatementTest(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleVariableAssignment(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier = left.obj.id;
    switch (right.type) {
        case "ArrayExpression": {
            return handleArrayExpression(stmtId, leftIdentifier, right, trackers);
        }

        case "CallExpression": {
            // const callee = getASTNode(right, "callee");
            // trackers.addFunctionCall(stmtId, callee);

            trackers = createAndStoreNewObjectNode(stmtId, leftIdentifier, trackers);
            // track all parameters of this function
            const args = getAllASTNodes(right, "arg");
            args.forEach(a => {
                trackers = handleCallExpression(stmtId, leftIdentifier, a, trackers);
            });
            return trackers;
        }

        case "ObjectExpression": {
            return createAndStoreNewObjectNode(stmtId, leftIdentifier, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, leftIdentifier, right, trackers);
        }

        case "FunctionExpression":
        case "FunctionDeclaration": {
            // const functionStartNode = getFDNode(right);
            // trackers.addFunctionToContext(functionStartNode);

            trackers = createAndStoreNewObjectNode(stmtId, leftIdentifier, trackers);
            // track all parameters of this function
            const params = getAllASTNodes(right, "param");
            params.forEach(p => {
                trackers = createAndStoreNewObjectNode(p.id, p.obj, trackers);
            });
            return trackers;
        }

        case "BinaryExpression": {
            return handleBinaryExpression(stmtId, leftIdentifier, right, trackers);
        }

        default: {
            return handleSimpleAssignment(stmtId, leftIdentifier, right, trackers);
        }
    }
}

function handleObjectWrite(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get location stored for this object
    // we only need the first because we know this is
    // not a binary expression or member expression
    const objStorage = evalSto(trackers, obj)[0];

    const objName = obj.obj.name;
    let propName = prop.obj.name;
    let sourceObjName = undefined;

    // if it is an object just evaluate and create new object version
    if (StorageFactory.isStorageObject(objStorage)) {
        const objLocation = (<StorageObject>objStorage).location;

        let deps;
        // if the member expression is computed  and is not a
        // Literal then we have to evaluate the dependencies
        // of the property as it is a variable,  because it
        // influences the object otherwise treat it is a Literal
        if (left.obj.computed && prop.type !== "Literal") {
            deps = evalDep(trackers, stmtId, prop);
            deps = [ ...deps, ...evalDep(trackers, stmtId, right) ];

            // change propName to be '*' since the property is dynamic
            propName = '*';
            sourceObjName = prop.obj.name;
        } else {
            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the
            // right side
            deps = evalDep(trackers, stmtId, right);
        }

        // evaluate storage and dependency of right-hand side expression
        // we only need the first because we know this is
        // not a binary expression or member expression
        const rightStorageValue = evalSto(trackers, right)[0];

        // replicate object
        let { newTrackers, newObjLocation } = trackers.createNewObjectVersion(stmtId, objName, propName, rightStorageValue);

        // set changes as creation of new object and write of property
        newTrackers.graphCreateNewObjectVersion(stmtId, objLocation, newObjLocation, deps, propName, sourceObjName);

        return newTrackers;
    }

    // ignore by cloning original values
    return trackers.clone();
}

function handleAssignmentExpression(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, left, right, trackers);
        }

        // object write
        case "MemberExpression": {
            return handleObjectWrite(stmtId, left, right, trackers);
        }
    }

    return trackers.clone();
}

function handleExpressionStatement(stmtId: number, node: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (node.type) {
        case "AssignmentExpression": {
            const left = getASTNode(node, "left");
            const right = getASTNode(node, "right");
            return handleAssignmentExpression(stmtId, left, right, trackers);
        }
    }

    return trackers.clone();
}

function pushContext(trackers: DependencyTracker, namespace: string): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.pushContext(namespace);
    return newTrackers;
}

function popContext(trackers: DependencyTracker): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.popContext();
    return newTrackers;
}

export function buildPDG(cfgGraph: Graph): Graph {
    const graph = cfgGraph;

    let trackers = new DependencyTracker();

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode, currentNamespace: string | null) {
        if (node === null) return;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        // check all possible statements after normalization
        switch (node.type) {
            case "CFG_F_START": {
                if (node.namespace) {
                    trackers = pushContext(trackers, node.namespace);
                }
                break;
            }

            case "IfStatement": {
                trackers = pushContext(trackers, node.id.toString());
                const ifTest = getASTNode(node, "test");

                // in this case we use the id of the test (identifier) node because
                // the CFG "extracts" this node from the AST and inlines it in the
                // control flow
                trackers = handleIfStatementTest(ifTest.id, ifTest, trackers);
                break;
            }

            case "CFG_F_END":
            case "CFG_IF_END": {
                trackers = popContext(trackers);
                break;
            }

            // expression statements are the majority of statements
            case "ExpressionStatement": {
                const expressionNode = getASTNode(node, "expression");
                if (expressionNode) {
                    trackers = handleExpressionStatement(node.id, expressionNode, trackers);
                }
                break;
            }

            case "VariableDeclarator": {
                const initNode = getASTNode(node, "init");
                if (initNode) {
                    trackers = handleVariableAssignment(node.id, node, initNode, trackers);
                }
                break;
            }

            case "FunctionDeclaration": {
                const params = getAllASTNodes(node, "param");
                params.forEach(p => {
                    trackers = createAndStoreNewObjectNode(p.id, p.obj.id, trackers);
                });
                break;
            }

            case "ReturnStatement": {
                const argument = getASTNode(node, "argument");
                if (argument) {
                    trackers = handleReturnArgument(node.id, argument, trackers);
                }
                break;
            }


            default:
                break;
        }

        trackers.updateGraph(graph);

        // traverse all child CFG nodes
        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                traverse(n, currentNamespace);
            });
    }

    // traverse CFG nodes
    const startNodes = graph.startNodes.get("CFG");
    startNodes?.forEach((node: GraphNode) => {
        traverse(node, node.namespace);
    });

    // trackers.createCallGraphEdges(graph);
    trackers.print();
    graph.clearUnusedObjectNodes();
    return graph;
}
