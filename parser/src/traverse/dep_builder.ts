import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { getASTNode, getNextObjectName } from "../utils/utils";
import { DependencyTracker, evalDep, evalSto, ValLattice, StorageObject } from "./dependency_trackers";

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


function handleObjectExpression(stmtId: number, variable: string, objExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // create new name for pdg object
    const pdgObjName = getNextObjectName();

    // add to heap
    newTrackers.addNewObjectToHeap(pdgObjName);

    // store the identifier of the new object
    newTrackers.addToStore(variable, {
        location: pdgObjName,
        value: ValLattice.Object
    });

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

function handleVariableAssignment(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier = left.obj.name;
    switch (right.type) {
        case "ObjectExpression": {
            return handleObjectExpression(stmtId, leftIdentifier, right, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, leftIdentifier, right, trackers);
        }

    //     case "CallExpression": {
    //         // apply var dependency for every argument
    //         const args = right.obj.arguments;
    //         args.forEach((arg: Identifier) => {
    //             const argIdentifier = arg.name;
    //             const previousVarStmt = trackers.phi.get(argIdentifier);
    //             if (previousVarStmt) {
    //                 trackers.gChanges.push({
    //                     op: "VAR",
    //                     source: previousVarStmt,
    //                     destination: stmtId,
    //                     name: argIdentifier
    //                 });
    //             }
    //         });

    //         // store the identifier of the return value (unknown)
    //         trackers.store.set(leftIdentifier, "__?__");
    //         // store the stmtid
    //         trackers.phi.set(leftIdentifier, stmtId);
    //         break;
    //     }

    //     case "BinaryExpression": {
    //         let objectType = ValLattice.Unknown;

    //         // apply var dependency for every argument (left & right)
    //         const args = [right.obj.left, right.obj.right];
    //         args.forEach((arg: Identifier) => {
    //             const argIdentifier = arg.name;

    //             // get value for union operation
    //             const argValue = trackers.store.get(argIdentifier);
    //             if (argValue && argValue === ValLattice.NoObject) {
    //                 objectType = ValLattice.NoObject;
    //             }

    //             const previousVarStmt = trackers.phi.get(argIdentifier);
    //             if (previousVarStmt) {
    //                 trackers.gChanges.push({
    //                     op: "VAR",
    //                     source: previousVarStmt,
    //                     destination: stmtId,
    //                     name: argIdentifier
    //                 });
    //             }
    //         });

    //         // store the identifier of the return value (unknown)
    //         trackers.store.set(leftIdentifier, objectType);
    //         // store the stmtid
    //         trackers.phi.set(leftIdentifier, stmtId);
    //         break;
    //     }

        default: {
            return handleSimpleAssignment(stmtId, leftIdentifier, right, trackers);
        }
    }

    // return trackers.clone();
}

function handleObjectWrite(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get location stored for this object
    const objStorage = evalSto(trackers, obj);

    if (!DependencyTracker.isStorageObject(objStorage)) return trackers.clone();
    const objLocation = (<StorageObject>objStorage).location;

    // evaluate storage and dependency of right-hand side expression
    const rightStorageValue = evalSto(trackers, right);
    const deps = evalDep(trackers, stmtId, right);

    // replicate object
    const { newTrackers, newObjLocation } = trackers.createNewObjectVersion(obj.obj.name, prop.obj.name, rightStorageValue);

    // set changes as creation of new object and write of property
    newTrackers.graphCreateNewObjectVersion(stmtId, objLocation, newObjLocation, deps, prop.obj.name);

    return newTrackers;
}

function handleAssignmentExpression(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {

    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, parent, left, right, trackers);
        }

        // object write
        case "MemberExpression": {
            return handleObjectWrite(stmtId, parent, left, right, trackers);
        }
    }

    return trackers.clone();
}

function handleExpressionStatement(stmtId: number, node: GraphNode, trackers: DependencyTracker): DependencyTracker {

    switch (node.type) {
        case "AssignmentExpression": {
            const left = getASTNode(node, "left");
            const right = getASTNode(node, "right");
            return handleAssignmentExpression(stmtId, node, left, right, trackers);
        }
    }

    return trackers.clone();
}

export function buildPDG(cfgGraph: Graph): Graph {
    const graph = cfgGraph;

    let trackers = new DependencyTracker();

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode) {
        if (node === null) return;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return;
        visitedNodes.push(node.id);

        // console.log(node.id, node.type);

        // check all possible statements after normalization
        switch (node.type) {

            // expression statements are the majority of statements
            case "ExpressionStatement": {
                const expressionNode = getASTNode(node, "expression");
                if (expressionNode) {
                    trackers = handleExpressionStatement(node.id, expressionNode, trackers);
                }
                break;
            }

            case "VariableDeclarator": {
                // console.log(node);
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
                traverse(n);
            });
    }

    // traverse CFG nodes
    const startNodes = graph.startNodes.get("CFG");
    startNodes?.forEach((node: GraphNode) => {
        traverse(node);
    });

    trackers.print();
    return graph;
}
