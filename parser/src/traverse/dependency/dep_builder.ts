import { GraphEdge } from "../graph/edge";
import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { clone, createThisExpression, getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto } from "./dependency_trackers";
import { StorageFactory, StorageObject, StorageValue } from "./sto_factory";
import { Identifier } from "estree";
import { DependencyFactory, Dependency } from "./dep_factory";

function handleSimpleAssignment(stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = trackers.getContextNameList(variable.name, stmt.functionContext).slice(-1)[0];

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    let storageValue = evalSto(trackers, expNode)[0];

    // if the expression does not correspond to an object then
    // we need to create a new object
    if (!StorageFactory.isStorageObject(storageValue)) {
        // const newObjReturn = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
        // newTrackers = newObjReturn.newTrackers;
    } else {
        // if the expression corresponds to a known object
        // then we are referencing this object and need to
        // store the identifier of the location
        trackers.addToStore(variableName, <StorageObject>storageValue);
    }

    deps.forEach(dep => trackers.graphCreateReferenceEdge(stmtId, dep.source));

    return trackers;
}

// function handleVariableLookup(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
//     // clone trackers
//     let newTrackers = trackers.clone();

//     // evaluate dependency of expression
//     const deps = evalDep(trackers, stmtId, expNode);

//     // apply dependencies to graph (var edges)
//     newTrackers.graphBuildEdge(deps);

//     return newTrackers;
// }

function handleBinaryExpression(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, BinExpNode);

    const newNodeId = createNewObjectNodeVariable(stmtId, stmt.functionContext, variable, trackers);

    deps.forEach(dep => trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep));
    trackers.graphCreateReferenceEdge(stmtId, newNodeId);

    return trackers;
}

function handleReturnArgument(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    if (deps.length > 0) {
        // create reference edge for value of return
        trackers.graphCreateReferenceEdge(stmtId, deps[0].source);
    }


    return trackers;
}

function createNewObjectNodeVariable(stmtId: number, functionContext: number, variable: Identifier, trackers: DependencyTracker): number {
    // create node for variable
    const variableName = trackers.getContextNameList(variable.name, functionContext).slice(-1)[0];
    const simpleVariableName = variable.name;

    // add to heap
    const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(simpleVariableName, variableName);

    // store the identifier of the new object
    trackers.addToStore(variableName, StorageFactory.StoObject(pdgObjNameContext));

    // store the stmtid
    // newTrackers.addToPhi(variableName, stmtId);

    // set changes as creation of new object
    return trackers.graphCreateNewObject(stmtId, simpleVariableName, pdgObjName, pdgObjNameContext);
}

function createNewObjectVersionNodesWithStorage(stmtId: number, objName: string, objNameContext: string, propName: string, rightStorageValue: StorageValue, deps: Dependency[], trackers: DependencyTracker) {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = clone(trackers.getHeapValue(lastObjLocation));
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {

            locationHeapValue[propName] = rightStorageValue;
            // add to heap
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);

            // newPropValue = trackers.createObjectProperties(stmtId, objName, objNameContext, propName);

            const newObjVersionId = trackers.graphCreateNewObject(stmtId, objName, pdgObjName, pdgObjNameContext);
            trackers.graphCreateNewVersionEdge(oldObjVersionId, newObjVersionId, propName);

            // store the identifier of the new object
            trackers.addToStore(objNameContext, StorageFactory.StoObject(pdgObjNameContext));

            const objNameProperty = `${pdgObjName}.${propName}`;
            const objNameContextProperty = `${pdgObjNameContext}.${propName}`;

            // add subobject to heap
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(newObjVersionId, subObjectId, propName);

            deps.forEach(dep => trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep));
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);
        }
    }
}

function createNewObjectVersionNodes(stmtId: number, objName: string, objNameContext: string, propName: string, deps: Dependency[], trackers: DependencyTracker) {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = clone(trackers.getHeapValue(lastObjLocation));
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {

            // add to heap
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);

            // newPropValue = trackers.createObjectProperties(stmtId, objName, objNameContext, propName);

            const newObjVersionId = trackers.graphCreateNewObject(stmtId, objName, pdgObjName, pdgObjNameContext);
            trackers.graphCreateNewVersionEdge(oldObjVersionId, newObjVersionId, propName);

            // store the identifier of the new object
            trackers.addToStore(objNameContext, StorageFactory.StoObject(pdgObjNameContext));

            const objNameProperty = `${pdgObjName}.${propName}`;
            const objNameContextProperty = `${pdgObjNameContext}.${propName}`;

            // add subobject to heap
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            locationHeapValue[propName] = StorageFactory.StoObject(propNamesInHeap.pdgObjNameContext);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(newObjVersionId, subObjectId, propName);

            deps.forEach(dep => trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep));
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);
        }
    }
}

function createSubObject(stmtId: number, objNameContext: string, propName: string, trackers: DependencyTracker) {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = trackers.getHeapValue(lastObjLocation);
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {

            const objNameProperty = `${objNameContext}.${propName}`;
            const objNameContextProperty = `${lastObjLocation}.${propName}`;

            // add to heap
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty, {});
            locationHeapValue[propName] = StorageFactory.StoObject(pdgObjNameContext);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, pdgObjName, pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(oldObjVersionId, subObjectId, propName);
        }
    }
}

function handleMemberExpression(stmtId: number, stmt: GraphNode, variable: Identifier, memExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, stmt.functionContext).slice(-1)[0];

    // get child nodes for the member expression
    const obj = getASTNode(memExpNode, "object");
    const prop = getASTNode(memExpNode, "property");

    // evaluate dependency of expression
    let deps = evalDep(trackers, stmtId, memExpNode);

    // if there are no dependencies then we have to create
    // the objects corresponding to the properties in the
    // memExpNode and re-run evalDep
    if (deps.length === 0) {
        const objName = obj.obj.name;
        const objNameContextList = trackers.getContextNameList(objName, stmt.functionContext);
        const validObj = trackers.getValidObject(objNameContextList);
        const objNameContext = validObj ? validObj.name : objNameContextList.slice(-1)[0];
        let propName = prop.obj.name;

        createSubObject(stmtId, objNameContext, propName, trackers);
        deps = evalDep(trackers, stmtId, memExpNode);
    }

    // check if this expression is already in storage
    // we just check the last value in storage because
    // it is the most recent
    const storageValueArray = evalSto(trackers, memExpNode);

    if (storageValueArray.length > 0) {
        let storageValue = storageValueArray.slice(-1)[0];
        if (!StorageFactory.isStorageObject(storageValue)) {
            // // if the expression is not an object then
            // // create a new one, otherwise we need a new object
            // const newObjReturn = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
            // newTrackers = newObjReturn.newTrackers;
        } else {
            // if the expression is a known object
            // then we just reference it
            const storeObj = <StorageObject>storageValue;

            // store the identifier of the location
            trackers.addToStore(variableNameContext, storeObj);
        }
    }

    trackers.graphCreateMemberExpressionDependencies(stmtId, deps);

    return trackers;
}

function createArrayElement(stmtId: number, objName: string, objNameContext: string, elementIndex: number, propValue: StorageValue, deps: Dependency[], trackers: DependencyTracker) {
    const lastLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastLocation) {
        const locationHeapValue = trackers.getHeapValue(lastLocation);
        const objVersionId = trackers.getObjectId(lastLocation);

        if (locationHeapValue && objVersionId) {
            const propName = elementIndex.toString();

            const objNameProperty = `${objNameContext}.${propName}`;
            const objNameContextProperty = `${lastLocation}.${propName}`;
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            locationHeapValue[propName] = StorageFactory.StoObject(propNamesInHeap.pdgObjNameContext);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(objVersionId, subObjectId, propName);

            deps.forEach(dep => trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep));
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);
        }
    }
}

function handleArrayExpressionElement(stmtId: number,  functionContext: number, variable: Identifier, elemNode: GraphNode, elementIndex: number, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, functionContext).slice(-1)[0];

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, elemNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, elemNode)[0];

    createArrayElement(stmtId, variableName, variableNameContext, elementIndex, storageValue, deps, trackers);

    return trackers;
}

function handleCallStatement(stmtId: number, functionContext: number, variable: Identifier, callNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // create new object
    const newObjId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    // process dependencies of call
    const deps = evalDep(trackers, stmtId, callNode);
    trackers.graphCreateCallStatementDependencies(stmtId, newObjId, deps);

    return trackers;
}

function handleObjectExpression(stmtId: number, functionContext: number, variable: Identifier, objExp: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // create new empty object node
    const newObjId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);

    // create reference edge
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    return trackers;
}

function handleArrayExpression(stmtId: number, functionContext: number, variable: Identifier, arrExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // create new empty object node
    const newObjId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    const arrElementEdges = getAllASTEdges(arrExpNode, "element");
    arrElementEdges.forEach((edge) => {
        const elementIndex = edge.elementIndex;
        const element = edge.nodes[1];
        trackers = handleArrayExpressionElement(stmtId, functionContext, variable, element, elementIndex, trackers);
    });

    return trackers;
}

// function handleIfStatementTest(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
//     // clone trackers
//     const newTrackers = trackers.clone();

//     // evaluate dependency of expression
//     const deps = evalDep(trackers, stmtId, expNode, undefined);

//     // apply dependencies to graph (var edges)
//     newTrackers.graphBuildEdge(deps);

//     return newTrackers;
// }


function handleFunctionDeclaration(stmtId: number, stmt: GraphNode, funcNode: GraphNode, funcIdentifier: Identifier, funcExpNode: GraphNode, trackers: DependencyTracker) : DependencyTracker {
    trackers = trackers.addFunctionContext(funcNode.id);

    // add context so that params are in the context of funcNode execution
    trackers = pushContext(trackers, funcNode.id);

    // // create the this object for all functions
    // newObjReturn = createAndStoreNewObjectNode(stmtId, funcNode, createThisExpression(), trackers);
    // trackers = newObjReturn.newTrackers;

    // track all parameters of this function
    const params = getAllASTNodes(funcExpNode, "param");
    params.forEach(p => {
        const paramName = (<Identifier>p.obj).name;
        const latestParamContextName = trackers.getContextNameList(paramName, funcNode.functionContext).slice(-1)[0];

        // create param node and connect to taint source
        trackers.addParamNode(stmtId, paramName, latestParamContextName);
    });

    trackers = popContext(trackers);
    return trackers;
}

function handleVariableAssignment(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;

    switch (right.type) {
        case "ArrayExpression": {
            return handleArrayExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        case "NewExpression":
        case "CallExpression": {
            return handleCallStatement(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        case "ObjectExpression": {
            return handleObjectExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        // // case "ClassDeclaration": {}

        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "FunctionDeclaration": {
            const funcNode = getFDNode(left);
            return handleFunctionDeclaration(stmtId, stmt, funcNode, leftIdentifier, right, trackers);
        }

        case "BinaryExpression": {
            return handleBinaryExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "Identifier": {
            return handleSimpleAssignment(stmtId, stmt, leftIdentifier, right, trackers);
        }
    }

    // placeholder
    return trackers;
}

function handleObjectWrite(stmtId: number, functionContext: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get context names
    const objName = obj.obj.name;
    const objNameContext = trackers.getContextNameList(objName, functionContext).slice(-1)[0];
    let propName = prop.obj.name;

    // get location stored for this object
    // we only need the first because we know this is
    // not a binary expression or member expression
    const sto = evalSto(trackers, obj);
    const objStorage = sto.slice(-1)[0];

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
    } else {
        // if the prop is a Literal or the member expression is not
        // computed then we just evaluate the dependencies for the
        // right side
        deps = evalDep(trackers, stmtId, right);
    }

    // if it is an object just evaluate and create new object version
    if (sto.length > 0 && StorageFactory.isStorageObject(objStorage)) {
        const objLocation = (<StorageObject>objStorage).location;

        // get storage of right-hand side expression
        // we only need the first because we know this is
        // not a binary expression or member expression
        const rightStorage = evalSto(trackers, right);

        if (rightStorage.length > 0 && StorageFactory.isStorageObject(rightStorage[0])) {
            // if the right hand side is an object
            // we want it to be in the sub object
            const rightStorageValue = rightStorage[0];
            // create new object version node
            // create sub object
            // connect all objects accordingly
            createNewObjectVersionNodesWithStorage(stmtId, objName, objNameContext, propName, rightStorageValue, deps, trackers);
        } else {
            createNewObjectVersionNodes(stmtId, objName, objNameContext, propName, deps, trackers);
        }
    }

    return trackers;
}

function handleAssignmentExpression(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, stmt, left, right, trackers);
        }

        // object write
        case "MemberExpression": {
            return handleObjectWrite(stmtId, stmt.functionContext, left, right, trackers);
        }
    }

    return trackers.clone();
}

function handleExpressionStatement(stmtId: number, stmt: GraphNode, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (expNode.type) {
        // case "Identifier": {
        //     return handleVariableLookup(stmtId, expNode, trackers);
        // }

        case "AssignmentExpression": {
            const left = getASTNode(expNode, "left");
            const right = getASTNode(expNode, "right");
            return handleAssignmentExpression(stmtId, stmt, left, right, trackers);
        }
    }

    return trackers.clone();
}

// function handleForInStatement(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
//     // clone trackers
//     let newTrackers = trackers.clone();

//     // evaluate dependency of right expression
//     let deps = evalDep(newTrackers, stmtId, left);
//     if (DependencyFactory.isDEmpty(deps[0])) {
//         const newObjReturn = createAndStoreNewObjectNode(left.id, left, left.obj, newTrackers);
//         newTrackers = newObjReturn.newTrackers;
//         deps = [];
//     }
//     deps = [...deps, ...evalDep(newTrackers, stmtId, right)];

//     // apply dependencies to graph (var edges)
//     newTrackers.graphBuildEdge(deps);

//     return newTrackers;
// }

// function handleWhileStatement(stmtId: number, test: GraphNode, trackers: DependencyTracker): DependencyTracker {
//     // clone trackers
//     const newTrackers = trackers.clone();

//     // evaluate dependency of expression
//     let deps = evalDep(trackers, stmtId, test, undefined);

//     // apply dependencies to graph (var edges)
//     newTrackers.graphBuildEdge(deps);

//     return newTrackers;
// }

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

    graph.addTaintNode();
    let trackers = new DependencyTracker(graph);

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
                    trackers = pushContext(trackers, node.id);
                }
                break;
            }

            // case "IfStatement": {
            //     const ifTest = getASTNode(node, "test");

            //     // in this case we use the id of the test (identifier) node because
            //     // the CFG "extracts" this node from the AST and inlines it in the
            //     // control flow
            //     trackers = handleIfStatementTest(ifTest.id, ifTest, trackers);
            //     break;
            // }

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
                }
                // else {
                //     // trackers.addVariable(p.obj.name, funcNode.id);
                //     trackers = createAndStoreNewObjectNode(node.id, node, node.obj.id, trackers).newTrackers;
                // }
                break;
            }

            // case "ExportNamedDeclaration": {
            //     const declarations = getAllASTNodes(node, "declaration");
            //     declarations.forEach((decl) => traverse(decl, currentNamespace));
            //     break;
            // }

            // // case "FunctionDeclaration": {
            // //     const params = getAllASTNodes(node, "param");
            // //     params.forEach(p => {
            // //         trackers = createAndStoreNewObjectNode(p.id, p.obj.id, trackers);
            // //     });
            // //     break;
            // // }

            // case "DoWhileStatement":
            // case "WhileStatement": {
            //     const test = getASTNode(node, "test");

            //     trackers = handleWhileStatement(test.id, test, trackers);
            //     break;
            // }

            // case "ForOfStatement":
            // case "ForInStatement": {
            //     const left = getASTNode(node, "left");
            //     const right = getASTNode(node, "right");

            //     trackers = handleForInStatement(node.id, left, right, trackers);
            //     break;
            // }

            case "ReturnStatement": {
                const argument = getASTNode(node, "argument");
                if (argument) {
                    trackers = handleReturnArgument(node.id, argument, trackers);
                }
                break;
            }

            // // case "ClassDeclaration": {
            // //     const body = getASTNode(node, "body");
            // //     const funcNode = getFDNode(body);
            // //     trackers = handleFunctionDeclaration(node.id, node, funcNode, leftIdentifier, right, trackers);
            // //     break;
            // // }

            default:
                break;
        }

        // console.log("=======================================");
        // trackers.print();


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
    return {
        graph,
        trackers
    };
}
