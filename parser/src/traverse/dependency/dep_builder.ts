import { GraphEdge } from "../graph/edge";
import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { getAllASTNodes, getASTNode, getNextObjectName } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto } from "./dependency_trackers";
import { StorageFactory, StorageMaybeObject, StorageObject } from "./sto_factory";

function handleSimpleAssignment(stmtId: number, variable: string, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // check if this expression is already in storage
    const storageValue = evalSto(trackers, expNode);

    // store the identifier of the location
    newTrackers.addToStore(variable, storageValue);

    // store the stmtid
    newTrackers.addToPhi(variable, stmtId);

    // apply dependencies to graph (var edges)
    newTrackers.graphBuildEdge(deps);

    return newTrackers;
}

function handleObjectExpression(stmtId: number, variable: string, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // create new name for pdg object
    const pdgObjName = getNextObjectName();

    // add to heap
    newTrackers.addNewObjectToHeap(pdgObjName);

    // store the identifier of the new object
    newTrackers.addToStore(variable, StorageFactory.StoObject(pdgObjName));

    // store the stmtid
    newTrackers.addToPhi(variable, stmtId);

    // set changes as creation of new object
    newTrackers.graphCreateNewObject(stmtId, pdgObjName);

    return newTrackers;
}

function handleMemberExpression(stmtId: number, variable: string, memExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, memExpNode);

    // check if this expression is already in storage
    const storageValue = evalSto(trackers, memExpNode);

    // store the identifier of the location
    newTrackers.addToStore(variable, storageValue);

    // store the stmtid
    newTrackers.addToPhi(variable, stmtId);

    // set changes as lookup from object
    newTrackers.graphLookupObject(deps);

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

function handleVariableAssignment(stmtId: number, leftIdentifier: string, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (right.type) {
        case "ObjectExpression": {
            return handleObjectExpression(stmtId, leftIdentifier, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, leftIdentifier, right, trackers);
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

    const objName = obj.obj.name;
    const propName = prop.obj.name;

    // get location stored for this object
    const objStorage = evalSto(trackers, obj);

    // if it is an object just evaluate and create new object version
    if (StorageFactory.isStorageObject(objStorage)) {
        const objLocation = (<StorageObject>objStorage).location;

        // evaluate storage and dependency of right-hand side expression
        const rightStorageValue = evalSto(trackers, right);
        const deps = evalDep(trackers, stmtId, right);

        // replicate object
        const { newTrackers, newObjLocation } = trackers.createNewObjectVersion(objName, propName, rightStorageValue);

        // set changes as creation of new object and write of property
        newTrackers.graphCreateNewObjectVersion(stmtId, objLocation, newObjLocation, deps, propName);

        return newTrackers;
    }

    // if maybe an object, then we have to create the subobject
    // because initially it didnt seem to be an object, but it is
    if (StorageFactory.checkMaybeObject(objStorage)) {
        const susObjStorage = <StorageMaybeObject>objStorage;
        const susProp = susObjStorage.susProp;

        // evaluate storage and dependency of right-hand side expression
        const rightStorageValue = evalSto(trackers, right);
        const deps = evalDep(trackers, stmtId, right);

        // create sub object
        const { newTrackers, newObjLocation, oldObjLocation } = trackers.createSubObject(objName, propName, susObjStorage, rightStorageValue);

        if (oldObjLocation) {
            // set changes as creation of new object and write of property
            newTrackers.graphCreateSubObject(stmtId, oldObjLocation, newObjLocation, susProp, deps, propName);
        }

        return newTrackers;
    }

    // ignore by cloning original values
    return trackers.clone();
}

function handleAssignmentExpression(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, left.obj.name, right, trackers);
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

        // console.log(node.id, node.type);

        // check all possible statements after normalization
        switch (node.type) {
            case "CFG_F_START": {
                if (node.namespace) {
                    trackers = pushContext(trackers, node.namespace);
                }
                // trackers.printContext();
                break;
            }

            case "IfStatement": {
                trackers = pushContext(trackers, node.id.toString());
                // trackers.printContext();
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
                // trackers.printContext();
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
                const identifier = node.obj.id.name;
                const initNode = getASTNode(node, "init");
                if (initNode) {
                    trackers = handleVariableAssignment(node.id, identifier, initNode, trackers);
                }
                break;
            }

            case "FunctionDeclaration": {
                const params = getAllASTNodes(node, "param");
                params.forEach(p => {
                    trackers = handleObjectExpression(node.id, p.obj.name, trackers);
                });
                break;
            }


            default:
                break;
        }

        // trackers.print();

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

    trackers.print();
    return graph;
}
