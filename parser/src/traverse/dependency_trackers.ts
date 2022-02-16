import { Identifier, Property } from "estree";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";
import { clone, getASTNode, getAllASTNodes, getNextObjectName } from "../utils/utils";
import exp from "constants";
import { string } from "yargs";

export enum ValLattice {
    Object,
    NoObject,
    Unknown,
};

enum GraphOperationType {
    CREATE_NEW_OBJECT,
    CREATE_DEPENDENCY_EDGE,
    CREATE_NEW_VERSION,
    WRITE_PROPERTY,
    LOOKUP_PROPERTY,
};

export interface StorageObject {
    location: string,
    value: ValLattice,
};

export interface StorageValLattice {
    value: ValLattice,
};

export type StorageObjectValue = StorageValLattice | StorageObject;

export interface HeapObject {
    [key: string]: ValLattice,
};

interface GraphOperation {
    op: GraphOperationType,
    name: string,
    source?: number,
    destination?: number,
    destinationNode?: string,
    depType?: string,
    depValue?: string
    previousObjectName?: string,
    propertyName?: string,
};

type Heap = Map<string, HeapObject>;
type Store = Map<string, StorageObjectValue[]>;
type Phi = Map<string, number>;
type GChanges = GraphOperation[];
type GNodes = Map<string, number>;

export class DependencyTracker {
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private gChanges: GChanges;
    private gNodes: GNodes;

    constructor() {
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.gChanges = new Array();
        this.gNodes = new Map();
    }

    addNewObjectToHeap(name: string) {
        this.heap.set(name, {});
    }

    addToStore(name: string, location: StorageObjectValue) {
        let storeArray = this.store.get(name);
        if (!storeArray) {
            storeArray = [];
        }

        storeArray.push(location);
        this.store.set(name, storeArray);
    }

    addToPhi(name: string, id: number) {
        this.phi.set(name, id);
    }

    graphCreateNewObject(sourceId: number, objName: string) {
        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_OBJECT,
            source: sourceId,
            name: objName,
        });
    }

    graphCreateNewObjectVersion(sourceId:number, sourceLocation: string, destinationLocation: string, deps: Dependency[], propName: string) {
        this.gChanges.push({
            op: GraphOperationType.WRITE_PROPERTY,
            source: sourceId,
            destinationNode: destinationLocation,
            name: propName,
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_VERSION,
            name: destinationLocation,
            previousObjectName: sourceLocation,
            propertyName: propName
        });

        deps.forEach(dep => {
            const name = dep.name || "";
            this.gChanges.push({
                op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
                name: name,
                depType: dep.type,
                depValue: dep.value,
                source: dep.source,
                destination: dep.destination
            });
        });
    }

    graphBuildEdge(deps: Dependency[]) {
        deps.forEach(dep => {
            const name = dep.name || "";
            this.gChanges.push({
                op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
                name: name,
                depType: dep.type,
                depValue: dep.value,
                source: dep.source,
                destination: dep.destination
            });
        });
    }

    graphLookupObject(deps: Dependency[]) {
        deps.forEach(dep => {
            const name = dep.name || "";
            this.gChanges.push({
                op: GraphOperationType.LOOKUP_PROPERTY,
                name: name,
                source: dep.source,
                destination: dep.destination
            });
        });
    }

    updateGraph(graph: Graph) {
        let change;
        while (change = this.gChanges.pop()) {
            switch (change.op) {
                case GraphOperationType.CREATE_NEW_OBJECT: {
                    // create node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(change.name, nodeObj.id);
                    nodeObj.identifier = change.name;

                    // add create edge
                    const source = change.source;
                    if (source) graph.addEdge(source, nodeObj.id, { type: "PDG", label: "CREATE", objName: change.name });
                    break;
                }

                case GraphOperationType.CREATE_NEW_VERSION: {
                    // create new version node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(change.name, nodeObj.id);
                    nodeObj.identifier = change.name;

                    // add new version edge
                    if (change.previousObjectName) {
                        const previousVersionId = this.gNodes.get(change.previousObjectName);
                        if (previousVersionId) {
                            graph.addEdge(previousVersionId, nodeObj.id, { type: "PDG", label: "NEW_VERSION", objName: change.propertyName });
                        }
                    }
                    break;
                }

                case GraphOperationType.WRITE_PROPERTY: {
                    const destinationNode = change.destinationNode;

                    if (destinationNode) {
                        const destinationNodeId = this.gNodes.get(destinationNode);
                        const source = change.source;
                        if (source && destinationNodeId) graph.addEdge(source, destinationNodeId, { type: "PDG", label: "WRITE", objName: change.name });
                    }
                    break;
                }

                case GraphOperationType.LOOKUP_PROPERTY: {
                    // get stmt id of source object
                    const source = change.source;
                    // get stmt id of destination
                    const destination = change.destination;
                    // add lookup edge
                    if (source && destination) {
                        graph.addEdge(source, destination, { type: "PDG", label: "LOOKUP", objName: change.name });
                    }
                    break;
                }

                case GraphOperationType.CREATE_DEPENDENCY_EDGE: {
                    if (change.source && change.destination && change.source !== change.destination) {
                        graph.addEdge(change.source, change.destination, { type: "PDG", label: "VAR", objName: change.name });
                    }
                    break;
                }
            }
        }
    }

    private setHeap(newHeap: Heap) {
        this.heap = new Map(newHeap);
    }

    private setStore(newStore: Store) {
        this.store = new Map(newStore);
    }

    private setPhi(newPhi: Phi) {
        this.phi = new Map(newPhi);
    }

    private setGChanges(newGChanges: GChanges) {
        const newArray = new Array();
        newGChanges.forEach(gop => newArray.push(gop));
        this.gChanges = newArray;
    }

    private setGNodes(newGNodes: GNodes) {
        this.gNodes = new Map(newGNodes);
    }

    getStorage(key: string): StorageObjectValue[] | undefined {
        return this.store.get(key);
    }

    getHeapValue(key: string): HeapObject | undefined {
        return this.heap.get(key);
    }

    getStatementId(key: string): number | undefined {
        return this.phi.get(key);
    }

    getObjectId(key: string): number | undefined {
        return this.gNodes.get(key);
    }

    static isStorageObject(sto: StorageObjectValue): boolean {
        return "location" in sto;
    }

    getObjectVersionsWithProp(objName: string, propName: string): number[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => DependencyTracker.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
            const objValues = objects.filter(o => {
                const value = this.getHeapValue(o);
                if (value) {
                    return propName in value;
                }

                return false;
            }) as string[];

            // if this property is not in the heap
            // we have to add it with Unknown value
            // for all stored objects
            if (objValues.length === 0) {
                objects.forEach(o => {
                    const value = this.getHeapValue(o);
                    if (value) {
                        value[propName] = ValLattice.Unknown;
                    }
                });

                // run this function again
                // now with the property in the heap
                return this.getObjectVersionsWithProp(objName, propName);
            }

            const objIds = objValues.map(o => this.getObjectId(o)) as number[];
            return objIds;
        }

        return [];
    }

    getPropStorage(objName: string, propName: string): StorageObjectValue[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => DependencyTracker.isStorageObject(sto));
            const objValues = objects.filter(o => {
                const sto = <StorageObject> o;

                const value = this.getHeapValue(sto.location);
                if (value) {
                    return propName in value;
                }

                return false;
            }) as StorageObject[];
            return objValues.map(ov => {
                const value = this.getHeapValue(ov.location);
                if (value) return {
                    value: value[propName]
                };
                return {
                    value: ValLattice.Unknown
                };
            });
        }

        return [];
    }

    createNewObjectVersion(objName: string, propName: string, propValue: StorageObjectValue) {
        const newTrackers = this.clone();

        const objLocations = this.store.get(objName);

        if (objLocations) {
            const lastObjLocation = objLocations[objLocations.length - 1];

            if (DependencyTracker.isStorageObject(lastObjLocation)) {
                const locationHeapValue = clone(this.heap.get((<StorageObject>lastObjLocation).location));

                if (locationHeapValue) {
                    const newObjName = getNextObjectName();
                    locationHeapValue[propName] = propValue.value;
                    objLocations.push({
                        location: newObjName,
                        value: ValLattice.Object,
                    });
                    newTrackers.heap.set(newObjName, locationHeapValue);

                    return {
                        newTrackers,
                        newObjLocation: newObjName
                    };
                }
            }
        }

        return {
            newTrackers,
            newObjLocation: objName
        };
    }

    clone(): DependencyTracker {
        const clone = new DependencyTracker();
        clone.setHeap(this.heap);
        clone.setStore(this.store);
        clone.setPhi(this.phi);
        clone.setGChanges(this.gChanges);
        clone.setGNodes(this.gNodes);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        console.log("Phi:", this.phi);
        console.log("Graph Nodes:", this.gNodes);
    }
};

enum DependencyType {
    DEmpty,
    DConst,
    DVar,
    DObject,
};

interface Dependency {
    type: string,
    name?: string,
    value?: string,
    source?: number,
    destination?: number
};

export class DependencyFactory {
    static DConst(c: string, stmtId: number): Dependency {
        return {
            type: DependencyType[DependencyType.DConst],
            value: c,
            source: stmtId,
            destination: stmtId,
        };
    }

    static DEmpty(): Dependency {
        return {
            type: DependencyType[DependencyType.DEmpty]
        };
    }

    static DVar(name: string, destination: number, source: number): Dependency {
        return {
            type: DependencyType[DependencyType.DVar],
            name: name,
            source: source,
            destination: destination,
        };
    }

    static DObject(propName: string, destination: number, sourceObjId: number): Dependency {
        return {
            type: DependencyType[DependencyType.DObject],
            name: propName,
            source: sourceObjId,
            destination: destination,
        };
    }
}


export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode): Dependency[] {
	switch (node.type) {
		case "Identifier": {
            const depStmtId = trackers.getStatementId(node.obj.name);
			return depStmtId ? [ DependencyFactory.DVar(node.obj.name, stmtId, depStmtId) ] : [ DependencyFactory.DEmpty() ];
		}

		case "Literal": {
			return [ DependencyFactory.DConst(node.obj.value, stmtId) ];
		}

        case "Property": {
            return evalDep(trackers, stmtId, getASTNode(node, "value"));
        }

        case "BinaryExpression": {
            const leftDep = evalDep(trackers, stmtId, getASTNode(node, "left"));
            const rightDep = evalDep(trackers, stmtId, getASTNode(node, "right"))
            return [ leftDep, rightDep ].flat();
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");

            const objIds = trackers.getObjectVersionsWithProp(obj.obj.name, prop.obj.name);
            return objIds.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId));
        }

        case "CallExpression": {
            return getAllASTNodes(node, "arg").map(arg => evalDep(trackers, stmtId, arg)).flat();
        }

		default: {
			return [ DependencyFactory.DEmpty() ];
		}
	}
}

function stoUnion(first: StorageObjectValue, second: StorageObjectValue): StorageObjectValue {
    if (first !== second) {
        return {
            value: ValLattice.NoObject
        };
    }

    return first;
}

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageObjectValue {
	switch (node.type) {
		case "Identifier": {
			const location = trackers.getStorage(node.obj.name);
            return location ? location[0] : {
                value: ValLattice.NoObject
            };
		}

		case "Literal": {
			return {
                value: ValLattice.NoObject
            };
		}

        case "BinaryExpression": {
            const leftSto = evalSto(trackers, getASTNode(node, "left"));
            const rightSto = evalSto(trackers, getASTNode(node, "right"))
            return stoUnion(leftSto, rightSto);
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");

            const objectsStorage = trackers.getPropStorage(obj.obj.name, prop.obj.name);
            return objectsStorage.reduce((first, second) => stoUnion(first, second));
        }

        default: {
            return {
                value: ValLattice.Unknown
            };
        }
	}
}