import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { clone, getASTNode, getAllASTNodes, getNextObjectName } from "../../utils/utils";
import { Dependency, DependencyFactory } from "./dep_factory";
import { StorageObject, StorageValue, StorageFactory, StorageMaybeObject } from "./sto_factory";

enum GraphOperationType {
    CREATE_NEW_OBJECT,
    CREATE_DEPENDENCY_EDGE,
    CREATE_NEW_VERSION,
    CREATE_SUB_OBJECT,
    WRITE_PROPERTY,
    LOOKUP_PROPERTY,
};

// interface GraphOperationBase {
//     op: GraphOperationType,
//     name: string,
//     pdgObjName?: string,
//     source?: number,
//     destination?: number,
//     destinationNode?: string,
//     depType?: string,
//     depValue?: string
//     previousObjectName?: string,
//     propertyName?: string,
// };

interface OpCreateNewObject {
    op: GraphOperationType.CREATE_NEW_OBJECT,
    objName: string,
    pdgObjName: string,
    source: number,
}

interface OpWriteProperty {
    op: GraphOperationType.WRITE_PROPERTY,
    propName: string,
    source: number,
    destination: string,
}

interface OpCreateNewVersion {
    op: GraphOperationType.CREATE_NEW_VERSION,
    name: string,
    previousObjName: string,
    propName: string,
}

interface OpCreateDependencyEdge {
    op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
    name: string,
    depType: string,
    depValue: string | undefined,
    source: number | undefined,
    destination: number | undefined
}

interface OpLookupProperty {
    op: GraphOperationType.LOOKUP_PROPERTY,
    propName: string,
    source: number | undefined,
    destination: number | undefined
}

interface OpCreateSubObject {
    op: GraphOperationType.CREATE_SUB_OBJECT,
    name: string,
    previousObjName: string,
    propName: string
}

type GraphOperation =
    OpCreateNewObject |
    OpWriteProperty |
    OpCreateNewVersion |
    OpCreateDependencyEdge |
    OpLookupProperty |
    OpCreateSubObject;

export interface HeapObject {
    [key: string]: StorageValue,
};

// export interface HeapObject {
//     [key: string]: ValLattice,
// };

type Heap = Map<string, HeapObject>;
type Store = Map<string, StorageValue[]>;
type Phi = Map<string, number>;
type GChanges = GraphOperation[];
type GNodes = Map<string, number>;
type ContextStack = string[];

export class DependencyTracker {
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private gChanges: GChanges;
    private gNodes: GNodes;
    private intraContextStack: ContextStack;

    constructor() {
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.gChanges = new Array<GraphOperation>();
        this.gNodes = new Map();
        this.intraContextStack = new Array<string>();
    }

    pushContext(namespace: string) {
        this.intraContextStack.push(namespace);
    }

    popContext(): string | undefined {
        return this.intraContextStack.pop();
    }

    addNewObjectToHeap(name: string) {
        this.heap.set(name, {});
    }

    addToHeap(name: string, heapObject: HeapObject) {
        this.heap.set(name, heapObject);
    }

    addPropInHeap(name: string, propName: string, value: StorageValue) {
        const heapValue = this.getHeapValue(name);
        if (heapValue) {
            heapValue[propName] = value;
        } else {
            const newHeapValue: HeapObject = {};
            newHeapValue[propName] = value;
            this.addToHeap(name, newHeapValue);
        }
    }

    replacePropInHeap(name: string, propName: string, value: StorageValue) {
        const heapValue = this.getHeapValue(name);
        // console.log(name, propName, heapValue);
        if (heapValue && propName in heapValue) {
            heapValue[propName] = value;
            // this.addToHeap(name, heapValue);
        }
    }

    addToStore(name: string, location: StorageValue) {
        let storeArray = this.getStorage(name);
        if (!storeArray) {
            storeArray = [];
        }

        storeArray.push(location);
        this.store.set(name, storeArray);
    }

    replaceInStore(name: string, location: StorageValue) {
        let storeArray = this.getStorage(name);
        if (!storeArray) {
            this.addToStore(name, location);
            return;
        }

        this.store.set(name, [ location ]);
    }

    addToPhi(name: string, id: number) {
        this.phi.set(name, id);
    }

    graphCreateNewObject(sourceId: number, objName: string, pdgObjName: string) {
        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_OBJECT,
            source: sourceId,
            objName: objName,
            pdgObjName: pdgObjName,
        });
    }

    graphCreateNewObjectVersion(sourceId:number, sourceLocation: string, destinationLocation: string, deps: Dependency[], propName: string) {
        this.gChanges.push({
            op: GraphOperationType.WRITE_PROPERTY,
            source: sourceId,
            destination: destinationLocation,
            propName: propName,
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_VERSION,
            name: destinationLocation,
            previousObjName: sourceLocation,
            propName: propName
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

    graphCreateSubObject(sourceId:number, sourceLocation: string, destinationLocation: string, susProp: string, deps: Dependency[], propName: string) {
        this.gChanges.push({
            op: GraphOperationType.WRITE_PROPERTY,
            source: sourceId,
            destination: destinationLocation,
            propName: propName,
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_SUB_OBJECT,
            name: destinationLocation,
            previousObjName: sourceLocation,
            propName: susProp
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
            const propName = dep.name || "";
            this.gChanges.push({
                op: GraphOperationType.LOOKUP_PROPERTY,
                propName: propName,
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
                    const specChange = <OpCreateNewObject>change;
                    // create node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(specChange.pdgObjName, nodeObj.id);
                    nodeObj.identifier = specChange.pdgObjName;

                    // add create edge
                    const source = specChange.source;
                    if (source) graph.addEdge(source, nodeObj.id, { type: "PDG", label: "CREATE", objName: specChange.objName });
                    break;
                }

                case GraphOperationType.CREATE_NEW_VERSION: {
                    const specChange = <OpCreateNewVersion>change;
                    // create new version node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(change.name, nodeObj.id);
                    nodeObj.identifier = change.name;

                    // add new version edge
                    const previousVersionId = this.gNodes.get(change.previousObjName);
                        if (previousVersionId) {
                            graph.addEdge(previousVersionId, nodeObj.id, { type: "PDG", label: "NEW_VERSION", objName: change.propName });
                        }
                    break;
                }

                case GraphOperationType.CREATE_SUB_OBJECT: {
                    // create new version node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(change.name, nodeObj.id);
                    nodeObj.identifier = change.name;

                    // add new version edge
                    const previousVersionId = this.gNodes.get(change.previousObjName);
                    if (previousVersionId) {
                        graph.addEdge(previousVersionId, nodeObj.id, { type: "PDG", label: "SUB_OBJECT", objName: change.propName });
                    }
                    break;
                }

                case GraphOperationType.WRITE_PROPERTY: {
                    const specChange = <OpWriteProperty>change;
                    // get id of object node (destination)
                    const destinationNodeId = this.gNodes.get(specChange.destination);
                    const source = specChange.source;
                    // add write edge
                    if (source && destinationNodeId) {
                        graph.addEdge(source, destinationNodeId, { type: "PDG", label: "WRITE", objName: specChange.propName });
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
                        graph.addEdge(source, destination, { type: "PDG", label: "LOOKUP", objName: change.propName });
                    }
                    break;
                }

                case GraphOperationType.CREATE_DEPENDENCY_EDGE: {
                    // add var dependency edge
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
        const newArray = new Array<GraphOperation>();
        newGChanges.forEach(gop => newArray.push(gop));
        this.gChanges = newArray;
    }

    private setGNodes(newGNodes: GNodes) {
        this.gNodes = new Map(newGNodes);
    }

    private setContext(newContext: ContextStack) {
        const newContextArray = new Array<string>();
        newContext.forEach(c => newContextArray.push(c));
        this.intraContextStack = newContextArray;
    }

    getStorage(key: string): StorageValue[] | undefined {
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

    getObjectVersionsWithProp(objName: string, propName: string): number[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
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
                        // value[propName] = ValLattice.Unknown;
                        value[propName] =StorageFactory.StoMaybeObject(objName, propName);
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

    getPropStorage(objName: string, propName: string): StorageValue[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto));
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
                if (value) return value[propName];
                return StorageFactory.StoMaybeObject(objName, propName);
            });
        }

        return [];
    }

    createNewObjectVersion(objName: string, propName: string, propValue: StorageValue) {
        const newTrackers = this.clone();

        const objLocations = this.getStorage(objName);

        if (objLocations) {
            const lastObjLocation = objLocations[objLocations.length - 1];

            if (StorageFactory.isStorageObject(lastObjLocation)) {
                const locationHeapValue = clone(this.getHeapValue((<StorageObject>lastObjLocation).location));

                if (locationHeapValue) {
                    const newObjName = getNextObjectName();
                    locationHeapValue[propName] = propValue;

                    // newTrackers.addToStore(objName, StorageFactory.StoObject(newObjName));
                    newTrackers.replaceInStore(objName, StorageFactory.StoObject(newObjName));

                    newTrackers.addToHeap(newObjName, locationHeapValue);

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

    createSubObject(objName: string, propName: string, objStorage: StorageMaybeObject, propValue: StorageValue) {
        const newTrackers = this.clone();
        // get name and property name of original object
        const { susObj, susProp } = objStorage;

        const susObjLocations = this.getStorage(susObj);

        if (susObjLocations) {
            const lastSusObjLocation = susObjLocations[susObjLocations.length - 1];

            if (StorageFactory.isStorageObject(lastSusObjLocation)) {
                const susLocationName = (<StorageObject>lastSusObjLocation).location;
                const susLocationHeapValue = clone(this.getHeapValue(susLocationName));

                if (susLocationHeapValue) {
                    const newObjName = getNextObjectName();
                    susLocationHeapValue[susProp] = propValue;

                    newTrackers.addPropInHeap(newObjName, propName, propValue);
                    newTrackers.replacePropInHeap(susLocationName, susProp, StorageFactory.StoObject(newObjName));
                    return {
                        newTrackers,
                        newObjLocation: newObjName,
                        oldObjLocation: susLocationName,
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
        clone.setContext(this.intraContextStack);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        console.log("Phi:", this.phi);
        console.log("Graph Nodes:", this.gNodes);
    }

    printContext() {
        console.log("Context:", this.intraContextStack);
    }
};


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

function stoUnion(first: StorageValue, second: StorageValue): StorageValue {
    if (first.value != second.value) {
        return StorageFactory.StoNoObject();
    }

    return first;
}

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageValue {
	switch (node.type) {
		case "Identifier": {
			const location = trackers.getStorage(node.obj.name);
            return location ? location[0] : StorageFactory.StoNoObject();
		}

		case "Literal": {
			return StorageFactory.StoNoObject();
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
            return objectsStorage.reduce(
                (first, second) => stoUnion(first, second),
               StorageFactory.StoMaybeObject(obj.obj.name, prop.obj.name),
            );
        }

        // case "ObjectExpression": {
        //     return StorageFactory.StoObject()
        // }

        default: {
            return StorageFactory.StoUnknown();
        }
	}
}