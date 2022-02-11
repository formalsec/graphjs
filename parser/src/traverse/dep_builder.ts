import { GraphEdge } from "./graph/edge";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { getNextObjectName } from "../utils/utils";
import { Property } from "estree";
import { DependencyTracker } from "./dependency_trackers";

// enum ValLattice {
//     NoObject,
//     Unknown,
// };

// interface GraphOperation {
//     op: string,
//     name: string,
//     source?: number,
//     destination?: number,
//     previousObjectName?: string,
//     propertyName?: string,
// };

// interface HeapObjectValue {
//     [key: string]: ValLattice | Object,
// };

// type Heap = Map<string, HeapObjectValue>;
// type Store = Map<string, string>;
// type Phi = Map<string, number>;
// type Dependencytrackers = {
//     "heap": Heap,
//     "store": Store,
//     "phi": Phi,
//     "gChanges": Array<GraphOperation>,
//     "gNodes": Map<string, number>,
// };

// function printAuxiliaryStructures(trackers: Dependencytrackers) {
//     console.log("Heap:", trackers.heap);
//     console.log("Store:", trackers.store);
//     console.log("Phi:", trackers.phi);
//     console.log("Graph Nodes:", trackers.gNodes);
// }

function getASTNode(parent: GraphNode, childLabel: string): GraphNode {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel)[0].nodes[1];
}

function handleObjectExpression(stmtId: number, variable: string, objExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // clone trackers
    const newTrackers = trackers.clone();

    // create new name for pdg object
    const pdgObjName = getNextObjectName();

    // TODO: avaliar as dependendias das propriedades
    // propDeps = evalDep(objExpNode)

    // add to heap
    newTrackers.addToHeap(pdgObjName, objExpNode.obj.properties as Property[]);

    // store the identifier of the new object
    newTrackers.addToStore(variable, pdgObjName);

    // store the stmtid
    newTrackers.addToPhi(variable, stmtId);

    // set changes as creation of new object
    newTrackers.graphCreateNewObject(stmtId, pdgObjName);

    return newTrackers;
}


function handleVariableAssignment(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier = left.obj.name;
    switch (right.type) {
        case "ObjectExpression": {
            return handleObjectExpression(stmtId, leftIdentifier, right, trackers);
        }

    //     case "MemberExpression": {
    //         const objectName = right.obj.object.name;
    //         const propertyName = right.obj.property.name;

    //         // get name of object node from store
    //         const objectLocation = trackers.store.get(objectName);
    //         if (objectLocation) {
    //             // get value of the object
    //             const heapObject = trackers.heap.get(objectLocation);

    //             if (heapObject) {
    //                 // get value of the property of this property (eg. __NO__)
    //                 let assignmentValue = heapObject[propertyName];

    //                 // add to the heap if this value is not known (__?__)
    //                 if (!assignmentValue) {
    //                     heapObject[propertyName] = ValLattice.Unknown;
    //                     trackers.heap.set(objectLocation, heapObject);
    //                     assignmentValue = heapObject[propertyName];
    //                 }

    //                 // store new variable using the value of the property
    //                 trackers.store.set(leftIdentifier, assignmentValue);
    //                 // store the stmtid
    //                 trackers.phi.set(leftIdentifier, stmtId);
    //                 // set changes as lookup of property
    //                 trackers.gChanges.push({
    //                     op: "LOOKUP",
    //                     name: objectName,
    //                     destination: stmtId,
    //                     previousObjectName: objectLocation,
    //                     propertyName: propertyName,
    //                 });
    //             }
    //         }
    //         break;
    //     }

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
    }

    return trackers.clone();
}

// function handleObjectWrite(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: Dependencytrackers): Dependencytrackers {
//     const objectName = left.obj.object.name;
//     const propertyName = left.obj.property.name;

//     // if object already in store
//     if (trackers.store.has(objectName)) {
//         // we have to create a new object (new version)
//         const newObjName = getNextObjectName();
//         // value for this object is NO
//         let newObjValue: HeapObjectValue = {};

//         if (right.type === "Literal") {
//             newObjValue[propertyName] = ValLattice.NoObject;
//         } else {
//             // We should actually check for var dependencies here
//             newObjValue[propertyName] = ValLattice.Unknown;
//         }

//         // add new object to heap
//         const previousObjectName = trackers.store.get(objectName);
//         trackers.heap.set(newObjName, newObjValue);
//         // change store to point to new object
//         trackers.store.set(objectName, newObjName);

//         // create new object
//         // add write edge from this statement
//         // add new version edge from previous version
//         trackers.gChanges.push({
//             op: "CREATE_NEW_VERSION",
//             source: stmtId,
//             name: newObjName,
//             previousObjectName: previousObjectName,
//             propertyName: propertyName,
//         });
//     }

//     return trackers;
// }

function handleAssignmentExpression(stmtId: number, parent: GraphNode, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {

    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, parent, left, right, trackers);
        }

        // // object write
        // case "MemberExpression": {
        //     return handleObjectWrite(stmtId, parent, left, right, trackers);
        // }
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
