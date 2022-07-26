import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { clone, getASTNode, getAllASTNodes, getNextObjectName } from "../../utils/utils";
import { Dependency, DependencyFactory } from "./dep_factory";
import { StorageObject, StorageValue, StorageFactory } from "./sto_factory";

enum GraphOperationType {
    CREATE_NEW_OBJECT,
    CREATE_DEPENDENCY_EDGE,
    CREATE_NEW_VERSION,
    WRITE_PROPERTY,
    LOOKUP_PROPERTY,
    CREATE_REFERENCE_EDGE,
};

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
    sourceObjName: string | undefined,
}

interface OpCreateNewVersion {
    op: GraphOperationType.CREATE_NEW_VERSION,
    name: string,
    previousObjName: string,
    propName: string,
    sourceObjName: string | undefined,
}

interface OpCreateDependencyEdge {
    op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
    name: string,
    depType: string,
    depValue: string | undefined,
    source: number | undefined,
    destination: number | undefined
}

interface OpCreateReferenceEdge {
    op: GraphOperationType.CREATE_REFERENCE_EDGE,
    name: string,
    source: number | undefined,
    destination: number | undefined
}

interface OpLookupProperty {
    op: GraphOperationType.LOOKUP_PROPERTY,
    propName: string,
    source: number | undefined,
    destination: number | undefined
}

type GraphOperation =
    OpCreateNewObject |
    OpWriteProperty |
    OpCreateNewVersion |
    OpCreateDependencyEdge |
    OpLookupProperty |
    OpCreateReferenceEdge;

export interface HeapObject {
    [key: string]: StorageValue,
};

type Heap = Map<string, HeapObject>;
type Store = Map<string, StorageValue[]>;
type Phi = Map<string, number>;
type References = Map<string, string[]>;
type GChanges = GraphOperation[];
type GNodes = Map<string, number>;
type ContextStack = string[];

export class DependencyTracker {
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private refs: References;
    private gChanges: GChanges;
    private gNodes: GNodes;
    private intraContextStack: ContextStack;

    constructor() {
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.refs = new Map();
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

    addNewObjectToHeap(name: string, heapObject?: HeapObject): string {
        // create new name for pdg object
        const pdgObjName = getNextObjectName(name);
        // console.log("Added Object", pdgObjName, "to Heap (", name, ")");
        if (heapObject) {
            this.addToHeap(pdgObjName, heapObject);
        } else {
            this.addToHeap(pdgObjName, {});
        }
        return pdgObjName;
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

        // if object add to refs
        if (StorageFactory.isStorageObject(location)) {
            this.addToRefs((<StorageObject>location).location, name);
        }

        this.store.set(name, storeArray);
    }

    addToRefs(location: string, name: string) {
        if (this.refs.has(location)) {
            this.refs.get(location)?.push(name);
        } else {
            this.refs.set(location, [name]);
        }
    }

    // replaceInStore(name: string, location: StorageValue) {
    //     let storeArray = this.getStorage(name);
    //     if (!storeArray) {
    //         this.addToStore(name, location);
    //         return;
    //     }

    //     this.store.set(name, [ location ]);
    // }

    addInStoreForAll(lastLocation: string, newLocation: StorageValue) {
        const allRefs = this.refs.get(lastLocation);
        allRefs?.forEach((name) => this.addToStore(name, newLocation));
    }

    getLastObjectLocation(objName: string): string | undefined {
        const objLocations = this.getStorage(objName);

        if (objLocations) {
            const lastObjLocation = objLocations[objLocations.length - 1];
            if (StorageFactory.isStorageObject(lastObjLocation)) {
                const stoObj = lastObjLocation as StorageObject;
                return stoObj.location;
            }
        }
    }

    needNewObjectNode(name: string, right: GraphNode): boolean {
        return this.getStorage(name) === undefined;
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

    graphCreateNewObjectVersion(sourceId:number, sourceLocation: string, destinationLocation: string, deps: Dependency[], propName: string, sourceObjName?: string) {
        console.log(propName, sourceObjName);
        this.gChanges.push({
            op: GraphOperationType.WRITE_PROPERTY,
            source: sourceId,
            destination: destinationLocation,
            propName: propName,
            sourceObjName,
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_VERSION,
            name: destinationLocation,
            previousObjName: sourceLocation,
            propName: propName,
            sourceObjName,
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

    graphBuildReferenceEdge(sourceId: number, variableName: string, location: string) {
        const locationId = this.gNodes.get(location);
        this.gChanges.push({
            op: GraphOperationType.CREATE_REFERENCE_EDGE,
            name: variableName,
            source: sourceId,
            destination: locationId,
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
                    this.gNodes.set(specChange.name, nodeObj.id);
                    nodeObj.identifier = specChange.name;

                    // add new version edge
                    const previousVersionId = this.gNodes.get(specChange.previousObjName);
                        if (previousVersionId) {
                            graph.addEdge(previousVersionId, nodeObj.id, {
                                type: "PDG",
                                label: "NEW_VERSION",
                                objName: specChange.propName,
                                sourceObjName: specChange.sourceObjName,
                            });
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
                        graph.addEdge(source, destinationNodeId, {
                            type: "PDG",
                            label: "WRITE",
                            objName: specChange.propName,
                            sourceObjName: specChange.sourceObjName
                        });
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

                case GraphOperationType.CREATE_REFERENCE_EDGE: {
                    // add var dependency edge
                    if (change.source && change.destination && change.source !== change.destination) {
                        graph.addEdge(change.source, change.destination, { type: "REF", label: "REF", objName: change.name });
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

    private setRefs(newRefs: References) {
        this.refs = new Map(newRefs);
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

    getObjectVersionsWithProp(stmtId: number, objName: string, propName: string): number[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
            if (objects.length > 0) {
                const objValues = objects.filter(o => {
                    const value = this.getHeapValue(o);
                    if (value) {
                        return propName in value;
                    }

                    return false;
                }) as string[];

                const objIds = objValues.map(o => this.getObjectId(o)) as number[];
                return objIds;
            }
        }

        return [];
    }

    getObjectVersions(objName: string): number[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
            const objIds = objects.map(o => this.getObjectId(o)) as number[];
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

            // get those that have the property in the name
            const objValues: StorageValue[] = [];
            objects.forEach(o => {
                const sto = <StorageObject> o;

                const value = this.getHeapValue(sto.location);
                if (value && propName in value) {
                    objValues.push(value[propName]);
                }
            });

            return objValues;
        }

        return [];
    }

    createNewObjectVersion(stmtId: number, objName: string, propName: string, propValue: StorageValue) {
        const newTrackers = this.clone();

        const lastObjLocation = this.getLastObjectLocation(objName);

        if (lastObjLocation) {
            const locationHeapValue = clone(this.getHeapValue(lastObjLocation));

            if (locationHeapValue) {
                const newObjName = newTrackers.addNewObjectToHeap(objName, locationHeapValue);

                let newPropValue = propValue;
                if (!StorageFactory.isStorageObject(propValue)) {
                    newPropValue = newTrackers.createObjectProperties(stmtId, objName, propName);
                }

                locationHeapValue[propName] = newPropValue;

                newTrackers.addInStoreForAll(lastObjLocation, StorageFactory.StoObject(newObjName));


                return {
                    newTrackers,
                    newObjLocation: newObjName
                };
            }
        }

        return {
            newTrackers,
            newObjLocation: objName
        };
    }

    createArrayElementInHeap(stmtId: number, objName: string, elementIndex: number, propValue: StorageValue) {
        const lastLocation = this.getLastObjectLocation(objName);

        if (lastLocation) {
            const locationHeapValue = clone(this.getHeapValue(lastLocation));

            if (locationHeapValue) {
                let newPropValue = propValue;
                if (!StorageFactory.isStorageObject(propValue)) {
                    newPropValue = this.createObjectProperties(stmtId, objName, elementIndex.toString());
                }

                locationHeapValue[elementIndex] = newPropValue;
                this.addToHeap(lastLocation, locationHeapValue);
            }
        }
    }

    createObjectProperties(stmtId: number, objName: string, propName: string): StorageValue {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
            const pdgObjName = this.addNewObjectToHeap(`${objName}.${propName}`);
            this.graphCreateNewObject(stmtId, `${objName}.${propName}`, pdgObjName);

            const propStorage = StorageFactory.StoObject(pdgObjName);
            objects.forEach(o => {
                const value = this.getHeapValue(o);
                if (value) {
                    // set changes as creation of new object
                    value[propName] = propStorage;
                }
            });
            return propStorage;
        }

        return StorageFactory.StoUnknown();
    }

    clone(): DependencyTracker {
        const clone = new DependencyTracker();
        clone.setHeap(this.heap);
        clone.setStore(this.store);
        clone.setPhi(this.phi);
        clone.setRefs(this.refs);
        clone.setGChanges(this.gChanges);
        clone.setGNodes(this.gNodes);
        clone.setContext(this.intraContextStack);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        console.log("Phi:", this.phi);
        console.log("Refs:", this.refs);
        console.log("Graph Nodes:", this.gNodes);
    }

    printContext() {
        console.log("Context:", this.intraContextStack);
    }
};


export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode): Dependency[] {
	switch (node.type) {
		case "Identifier": {
            // const depStmtId = trackers.getStatementId(node.obj.name);
            const depObjIds = trackers.getObjectVersions(node.obj.name);
			return depObjIds.length > 0 ? [ DependencyFactory.DVar(node.obj.name, stmtId, depObjIds[0]) ] : [ DependencyFactory.DEmpty() ];
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

            const objIds = trackers.getObjectVersionsWithProp(stmtId, obj.obj.name, prop.obj.name);
            return objIds.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId));
        }

        case "CallExpression": {
            return getAllASTNodes(node, "arg").map(arg => evalDep(trackers, stmtId, arg)).flat();
        }

        case "TemplateLiteral": {
            return getAllASTNodes(node, "expression").map(exp => evalDep(trackers, stmtId, exp)).flat();
        }

		default: {
			return [ DependencyFactory.DEmpty() ];
		}
	}
}

// function stoUnion(first: StorageValue, second: StorageValue): StorageValue {
//     if (StorageFactory.isStorageObject(first)) {
//         return first;
//     } else if (StorageFactory.isStorageObject(second)) {
//         return second;
//     } else if (first.value !== second.value) {
//         return StorageFactory.StoNoObject();
//     }

//     return first;
// }

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageValue[] {
	switch (node.type) {
		case "Identifier": {
			const locations = trackers.getStorage(node.obj.name);
            return locations ? locations.slice(-1) : [ StorageFactory.StoNoObject() ];
		}

		case "Literal": {
            return [ StorageFactory.StoNoObject() ];
		}

        case "BinaryExpression": {
            const leftSto = evalSto(trackers, getASTNode(node, "left"));
            const rightSto = evalSto(trackers, getASTNode(node, "right"))
            return [ ...leftSto, ...rightSto ];
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");

            const stos = trackers.getPropStorage(obj.obj.name, prop.obj.name);
            return stos.length > 0 ? stos : [ StorageFactory.StoUnknown() ];
        }

        default: {
            return [ StorageFactory.StoUnknown() ];
        }
	}
}