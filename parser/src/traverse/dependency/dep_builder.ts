import { GraphEdge } from "../graph/edge";
import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { createThisExpression, getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto } from "./dependency_trackers";
import { StorageFactory, StorageObject } from "./sto_factory";
import { Identifier } from "estree";
import { DependencyFactory } from "./dep_factory";

function handleSimpleAssignment(stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = trackers.getContextNameList(variable.name, stmt.functionContext).slice(-1)[0];

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
        newTrackers = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
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

function handleVariableLookup(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleBinaryExpression(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, BinExpNode);

    newTrackers = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);

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

function createAndStoreNewObjectNode(stmtId: number, stmt: GraphNode, variable: Identifier, trackers: DependencyTracker): DependencyTracker {
    const variableName = trackers.getContextNameList(variable.name, stmt.functionContext).slice(-1)[0];
    const simpleVariableName = variable.name;

    // clone trackers
    const newTrackers = trackers.clone();

    // add to heap
    const { pdgObjName, pdgObjNameContext } = newTrackers.addNewObjectToHeap(simpleVariableName, variableName);

    // store the identifier of the new object
    newTrackers.addToStore(variableName, StorageFactory.StoObject(pdgObjNameContext));

    // store the stmtid
    newTrackers.addToPhi(variableName, stmtId);

    // set changes as creation of new object
    newTrackers.graphCreateNewObject(stmtId, simpleVariableName, pdgObjName, pdgObjNameContext);

    return newTrackers;
}

function handleMemberExpression(stmtId: number, stmt: GraphNode, variable: Identifier, memExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, stmt.functionContext).slice(-1)[0];

    // get child nodes for the member expression
    const obj = getASTNode(memExpNode, "object");
    const prop = getASTNode(memExpNode, "property");

    const objName = obj.obj.name;
    const objNameContextList = trackers.getContextNameList(objName, stmt.functionContext);
    const validObj = trackers.getValidObject(objNameContextList);
    const objNameContext = validObj ? validObj.name : objNameContextList.slice(-1)[0];
    let propName = prop.obj.name;

    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of expression
    let deps = evalDep(newTrackers, stmtId, memExpNode);

    // if there are no dependencies then we have to create
    // the objects corresponding to the properties in the
    // memExpNode and re-run evalDep
    if (deps.length === 0) {
        newTrackers.createObjectProperties(stmtId, objName, objNameContext, propName);
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
        newTrackers = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
    } else {
        // store the identifier of the location
        newTrackers.addToStore(variableNameContext, storageValue);

        // store the stmtid
        newTrackers.addToPhi(variableNameContext, stmtId);

        const location = (<StorageObject> storageValue).location;
        newTrackers.graphBuildReferenceEdge(stmtId, variableName, location);
    }

    // set changes as lookup from object
    newTrackers.graphLookupObject(deps);

    return newTrackers;
}

function handleArrayExpressionElement(stmtId: number, stmt: GraphNode, variable: Identifier, elemNode: GraphNode, elementIndex: number, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, stmt.functionContext).slice(-1)[0];

    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, elemNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, elemNode)[0];

    newTrackers.createArrayElementInHeap(stmtId, variableName, variableNameContext, elementIndex, storageValue);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleCallExpression(stmtId: number, stmt: GraphNode, variable: Identifier, callNode: GraphNode, trackers: DependencyTracker) {
    // clone trackers
    let newTrackers = trackers.clone();

    newTrackers = createAndStoreNewObjectNode(stmtId, stmt, variable, newTrackers);
    // track all parameters of this function
    // const args = getAllASTNodes(callNode, "arg");
    // args.forEach(a => {
    //     newTrackers = handleCallArguments(stmtId, a, newTrackers);
    // });

    const deps = evalDep(newTrackers, stmtId, callNode);
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleArrayExpression(stmtId: number, stmt: GraphNode, variable: Identifier, arrExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    newTrackers = createAndStoreNewObjectNode(stmtId, stmt, variable, newTrackers);

    const arrElementEdges = getAllASTEdges(arrExpNode, "element");
    arrElementEdges.forEach((edge) => {
        const elementIndex = edge.elementIndex;
        const element = edge.nodes[1];
        newTrackers = handleArrayExpressionElement(stmtId, stmt, variable, element, elementIndex, newTrackers);
    });

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

function handleVariableAssignment(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;

    switch (right.type) {
        case "ArrayExpression": {
            return handleArrayExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "NewExpression":
        case "CallExpression": {
            return handleCallExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "ObjectExpression": {
            return createAndStoreNewObjectNode(stmtId, stmt, leftIdentifier, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        // case "ClassDeclaration": {}

        case "FunctionExpression":
        case "FunctionDeclaration": {
            const funcNode = getFDNode(left);
            return handleFunctionDeclaration(stmtId, stmt, funcNode, leftIdentifier, right, trackers);
        }

        case "BinaryExpression": {
            return handleBinaryExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        default: {
            return handleSimpleAssignment(stmtId, stmt, leftIdentifier, right, trackers);
        }
    }
}

function handleFunctionDeclaration(stmtId: number, stmt: GraphNode, funcNode: GraphNode, funcIdentifier: Identifier, funcExpNode: GraphNode, trackers: DependencyTracker) : DependencyTracker {
    trackers = trackers.addFunctionContext(funcNode.id);
    trackers = createAndStoreNewObjectNode(stmtId, stmt, funcIdentifier, trackers);
    trackers = pushContext(trackers, funcNode.id);

    // create the this object for all functions
    trackers = createAndStoreNewObjectNode(stmtId, funcNode, createThisExpression(), trackers);

    // track all parameters of this function
    const params = getAllASTNodes(funcExpNode, "param");
    params.forEach(p => {
        // trackers.addVariable(p.obj.name, funcNode.id);
        trackers = createAndStoreNewObjectNode(p.id, funcNode, p.obj, trackers);
    });
    trackers = popContext(trackers);
    return trackers;
}

function handleObjectWrite(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get location stored for this object
    // we only need the first because we know this is
    // not a binary expression or member expression
    const objStorage = evalSto(trackers, obj)[0];

    const objName = obj.obj.name;
    const objNameContext = trackers.getContextNameList(objName, stmt.functionContext).slice(-1)[0];
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
        let { newTrackers, newObjLocation, newObjLocationContext } = trackers.createNewObjectVersion(stmtId, objName, objNameContext, propName, rightStorageValue);

        // set changes as creation of new object and write of property
        newTrackers.graphCreateNewObjectVersion(stmtId, objLocation, newObjLocation, newObjLocationContext, deps, propName, sourceObjName);

        return newTrackers;
    }

    // ignore by cloning original values
    return trackers.clone();
}

function handleAssignmentExpression(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, stmt, left, right, trackers);
        }

        // object write
        case "MemberExpression": {
            return handleObjectWrite(stmtId, stmt, left, right, trackers);
        }
    }

    return trackers.clone();
}

function handleExpressionStatement(stmtId: number, stmt: GraphNode, node: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (node.type) {
        case "Identifier": {
            return handleVariableLookup(stmtId, node, trackers);
        }

        case "AssignmentExpression": {
            const left = getASTNode(node, "left");
            const right = getASTNode(node, "right");
            return handleAssignmentExpression(stmtId, stmt, left, right, trackers);
        }
    }

    return trackers.clone();
}

function handleForInStatement(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    let newTrackers = trackers.clone();

    // evaluate dependency of right expression
    let deps = evalDep(newTrackers, stmtId, left);
    if (DependencyFactory.isDEmpty(deps[0])) {
        newTrackers = createAndStoreNewObjectNode(left.id, left, left.obj, newTrackers);
        deps = [];
    }
    deps = [...deps, ...evalDep(newTrackers, stmtId, right)];

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleWhileStatement(stmtId: number, test: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    let deps = evalDep(trackers, stmtId, test);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function pushContext(trackers: DependencyTracker, context: number): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.pushContext(context);
    return newTrackers;
}

function popContext(trackers: DependencyTracker): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.popContext();
    return newTrackers;
}

export interface PDGReturn {
    graph: Graph,
    trackers: DependencyTracker,
};

export function buildPDG(cfgGraph: Graph): PDGReturn {
    const graph = cfgGraph;

    let trackers = new DependencyTracker(graph);

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode, currentNamespace: string | null) {
        if (node === null) return;

        // console.log(node.id, node.type);

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        // check all possible statements after normalization
        switch (node.type) {
            case "CFG_F_START": {
                if (node.namespace) {
                    trackers = pushContext(trackers, node.id);
                }
                break;
            }

            case "IfStatement": {
                const ifTest = getASTNode(node, "test");

                // in this case we use the id of the test (identifier) node because
                // the CFG "extracts" this node from the AST and inlines it in the
                // control flow
                trackers = handleIfStatementTest(ifTest.id, ifTest, trackers);
                break;
            }

            case "CFG_F_END": {
                trackers = popContext(trackers);
                break;
            }

            // expression statements are the majority of statements
            case "ExpressionStatement": {
                const expressionNode = getASTNode(node, "expression");
                if (expressionNode) {
                    trackers = handleExpressionStatement(node.id, node, expressionNode, trackers);
                }
                break;
            }

            case "VariableDeclarator": {
                const initNode = getASTNode(node, "init");
                if (initNode) {
                    trackers = handleVariableAssignment(node.id, node, node, initNode, trackers);
                } else {
                    // trackers.addVariable(p.obj.name, funcNode.id);
                    trackers = createAndStoreNewObjectNode(node.id, node, node.obj.id, trackers);
                }
                break;
            }

            case "ExportNamedDeclaration": {
                const declarations = getAllASTNodes(node, "declaration");
                declarations.forEach((decl) => traverse(decl, currentNamespace));
                break;
            }

            // case "FunctionDeclaration": {
            //     const params = getAllASTNodes(node, "param");
            //     params.forEach(p => {
            //         trackers = createAndStoreNewObjectNode(p.id, p.obj.id, trackers);
            //     });
            //     break;
            // }

            case "DoWhileStatement":
            case "WhileStatement": {
                const test = getASTNode(node, "test");

                trackers = handleWhileStatement(test.id, test, trackers);
                break;
            }

            case "ForOfStatement":
            case "ForInStatement": {
                const left = getASTNode(node, "left");
                const right = getASTNode(node, "right");

                trackers = handleForInStatement(node.id, left, right, trackers);
                break;
            }

            case "ReturnStatement": {
                const argument = getASTNode(node, "argument");
                if (argument) {
                    trackers = handleReturnArgument(node.id, argument, trackers);
                }
                break;
            }

            // case "ClassDeclaration": {
            //     const body = getASTNode(node, "body");
            //     const funcNode = getFDNode(body);
            //     trackers = handleFunctionDeclaration(node.id, node, funcNode, leftIdentifier, right, trackers);
            //     break;
            // }

            default:
                break;
        }

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

    trackers.print();
    // graph.clearUnusedObjectNodes();
    return {
        graph,
        trackers
    };
}
