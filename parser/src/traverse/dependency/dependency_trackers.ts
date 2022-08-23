import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { clone, getASTNode, getAllASTNodes, getNextObjectName, ContextNames, copyObj } from "../../utils/utils";
import { Dependency, DependencyFactory } from "./dep_factory";
import { StorageObject, StorageValue, StorageFactory } from "./sto_factory";

enum GraphOperationType {
    CREATE_NEW_OBJECT,
    CREATE_DEPENDENCY_EDGE,
    CREATE_NEW_VERSION,
    WRITE_PROPERTY,
    LOOKUP_PROPERTY,
    CREATE_REFERENCE_EDGE,
    CREATE_SUB_OBJECT_EDGE,
};

interface OpCreateNewObject {
    op: GraphOperationType.CREATE_NEW_OBJECT,
    objName: string,
    pdgObjName: string,
    pdgObjNameContext: string,
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
    nameContext: string,
    previousObjName: string,
    propName: string,
    sourceObjName: string | undefined,
}

interface OpCreateDependencyEdge {
    op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
    name: string,
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
    destination: number | undefined,
    sourceObjName: string | undefined,
}

interface OpCreateSubObjectEdge {
    op: GraphOperationType.CREATE_SUB_OBJECT_EDGE,
    objName: string,
    source: number | undefined,
    pdgObjName: string,
}

type GraphOperation =
    OpCreateNewObject |
    OpWriteProperty |
    OpCreateNewVersion |
    OpCreateDependencyEdge |
    OpLookupProperty |
    OpCreateReferenceEdge |
    OpCreateSubObjectEdge;

export interface HeapObject {
    [key: string]: StorageValue,
};

type Heap = Map<string, HeapObject>;
type Store = Map<string, StorageValue[]>;
type Phi = Map<string, number>;
type References = Map<string, string[]>;
type GChanges = GraphOperation[];
type GNodes = Map<string, number>;
type FContexts = Map<number, number[]>;

export class DependencyTracker {
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private refs: References;
    private gChanges: GChanges;
    private gNodes: GNodes;
    private funcContexts: FContexts;
    private intraContextStack: number[];

    constructor() {
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.refs = new Map();
        this.gChanges = new Array<GraphOperation>();
        this.gNodes = new Map();
        this.funcContexts = new Map();
        this.intraContextStack = new Array<number>();
    }

    addFunctionContext(declaredFuncId: number): DependencyTracker {
        const newTrackers = this.clone();
        if (newTrackers.intraContextStack.length > 0) {
            const lastFunc = newTrackers.intraContextStack.slice(-1)[0];
            const lastFuncContexts = newTrackers.funcContexts.get(lastFunc);
            if (lastFuncContexts) {
                newTrackers.funcContexts.set(declaredFuncId, [...lastFuncContexts, lastFunc]);
            } else {
                newTrackers.funcContexts.set(declaredFuncId, [lastFunc])
            }
        } else {
            newTrackers.funcContexts.set(declaredFuncId, [])
        }
        return newTrackers;
    }

    pushContext(context: number) {
        this.intraContextStack.push(context);
    }

    popContext(): number | undefined {
        return this.intraContextStack.pop();
    }

    getContextName(name: string): string[] {
        const latestContext = this.intraContextStack.slice(-1)[0];
        const contextList = this.funcContexts.get(latestContext);
        return contextList ? [...contextList, latestContext].map(ctx => `${ctx}.${name}`) : [`${latestContext.toString()}.${name}`];
    }

    addNewObjectToHeap(name: string, nameContext: string, heapObject?: HeapObject): ContextNames {
        // create new name for pdg object
        const { pdgObjName, pdgObjNameContext } = getNextObjectName(name, nameContext);
        if (heapObject) {
            this.addToHeap(pdgObjNameContext, heapObject);
        } else {
            this.addToHeap(pdgObjNameContext, {});
        }
        return {
            pdgObjName,
            pdgObjNameContext
        };
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
        if (heapValue && propName in heapValue) {
            heapValue[propName] = value;
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

    graphCreateNewObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string) {
        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_OBJECT,
            source: sourceId,
            objName,
            pdgObjName,
            pdgObjNameContext
        });
    }

    graphCreateNewSubObject(sourceId: number, objects: string[], objName: string, propName: string, pdgObjName: string, pdgObjNameContext: string) {
        // this op must be written to gChanges first
        objects.forEach(obj => {
            const sourceObjId = this.gNodes.get(obj);
            this.gChanges.push({
                op: GraphOperationType.CREATE_SUB_OBJECT_EDGE,
                source: sourceObjId,
                objName: propName,
                pdgObjName,
            });
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_OBJECT,
            source: sourceId,
            objName,
            pdgObjName,
            pdgObjNameContext,
        });
    }

    graphCreateNewObjectVersion(sourceId: number, srcLocation: string, dstLocation: string, dstLocationContext: string, deps: Dependency[], propName: string, sourceObjName?: string) {
        this.gChanges.push({
            op: GraphOperationType.WRITE_PROPERTY,
            source: sourceId,
            destination: dstLocationContext,
            propName: propName,
            sourceObjName,
        });

        this.gChanges.push({
            op: GraphOperationType.CREATE_NEW_VERSION,
            name: dstLocation,
            nameContext: dstLocationContext,
            previousObjName: srcLocation,
            propName: propName,
            sourceObjName,
        });

        deps.forEach(dep => {
            const name = dep.name || "";
            this.gChanges.push({
                op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
                name: name,
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

            if (DependencyFactory.isDVar(dep.type)) {
                const name = dep.name || "";
                this.gChanges.push({
                    op: GraphOperationType.CREATE_DEPENDENCY_EDGE,
                    name: name,
                    depValue: dep.value,
                    source: dep.source,
                    destination: dep.destination
                });
            } else {
                this.gChanges.push({
                    op: GraphOperationType.LOOKUP_PROPERTY,
                    propName: propName,
                    source: dep.source,
                    destination: dep.destination,
                    sourceObjName: dep.sourceObjName,
                });
            }
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
                    this.gNodes.set(specChange.pdgObjNameContext, nodeObj.id);
                    nodeObj.identifier = specChange.pdgObjName;

                    // add create edge
                    const source = specChange.source;
                    if (source) {
                        graph.addEdge(source, nodeObj.id, { type: "PDG", label: "CREATE", objName: specChange.objName });
                    }
                    break;
                }

                case GraphOperationType.CREATE_SUB_OBJECT_EDGE: {
                    const specChange = <OpCreateSubObjectEdge>change;
                    const destinationObjId = this.gNodes.get(specChange.pdgObjName);
                    // add create edge
                    const source = specChange.source;
                    if (source && destinationObjId) {
                        graph.addEdge(source, destinationObjId, { type: "SUB", label: "SUB_OBJECT", objName: specChange.objName });
                    }
                    break;
                }

                case GraphOperationType.CREATE_NEW_VERSION: {
                    const specChange = <OpCreateNewVersion>change;
                    // create new version node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(specChange.nameContext, nodeObj.id);
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
                        graph.addEdge(source, destination, {
                            type: "PDG",
                            label: "LOOKUP",
                            objName: change.propName,
                            sourceObjName: change.sourceObjName,
                        });
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

    private setFuncContexts(newFuncContext: FContexts) {
        this.funcContexts = new Map(newFuncContext);
    }

    private setContext(newContext: number[]) {
        const newContextArray = new Array<number>();
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

    getObjectVersions(objName: string, objNameContextList: string[]): number[] {
        let objStorage;
        for (let i = objNameContextList.length - 1; i >= 0; i--) {
            objStorage = this.getStorage(objNameContextList[i]);
            if (objStorage) break;
        }
        // get version of object in storage

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

    createNewObjectVersion(stmtId: number, objName: string, objNameContext: string, propName: string, propValue: StorageValue) {
        const newTrackers = this.clone();

        const lastObjLocation = this.getLastObjectLocation(objNameContext);

        if (lastObjLocation) {
            const locationHeapValue = clone(this.getHeapValue(lastObjLocation));

            if (locationHeapValue) {
                const { pdgObjName, pdgObjNameContext } = newTrackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);

                let newPropValue = propValue;
                if (!StorageFactory.isStorageObject(propValue)) {
                    newPropValue = newTrackers.createObjectProperties(stmtId, objName, objNameContext, propName);
                }

                locationHeapValue[propName] = newPropValue;

                newTrackers.addInStoreForAll(lastObjLocation, StorageFactory.StoObject(pdgObjNameContext));


                return {
                    newTrackers,
                    newObjLocation: pdgObjName,
                    newObjLocationContext: pdgObjNameContext,
                };
            }
        }

        return {
            newTrackers,
            newObjLocation: objName,
            newObjLocationContext: objNameContext,
        };
    }

    createArrayElementInHeap(stmtId: number, objName: string, objNameContext: string, elementIndex: number, propValue: StorageValue) {
        const lastLocation = this.getLastObjectLocation(objNameContext);

        if (lastLocation) {
            const locationHeapValue = clone(this.getHeapValue(lastLocation));

            if (locationHeapValue) {
                let newPropValue = propValue;
                if (!StorageFactory.isStorageObject(propValue)) {
                    newPropValue = this.createObjectProperties(stmtId, objName, objNameContext, elementIndex.toString());
                }

                locationHeapValue[elementIndex] = newPropValue;
                this.addToHeap(lastLocation, locationHeapValue);
            }
        }
    }

    createObjectProperties(stmtId: number, objName: string, objNameContext: string, propName: string): StorageValue {
        // get version of object in storage
        const objStorage = this.getStorage(objNameContext);

        if (objStorage) {
            const objNameProperty = `${objName}.${propName}`;
            const objNameContextProperty = `${objNameContext}.${propName}`;
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
            const { pdgObjName, pdgObjNameContext } = this.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            this.graphCreateNewSubObject(stmtId, objects, objNameProperty, propName, pdgObjName, pdgObjNameContext);

            const propStorage = StorageFactory.StoObject(pdgObjNameContext);
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
        clone.setFuncContexts(this.funcContexts);
        clone.setContext(this.intraContextStack);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        console.log("Phi:", this.phi);
        console.log("Refs:", this.refs);
        console.log("Graph Nodes:", this.gNodes);
        console.log("Func Contexts:", this.funcContexts);
    }

    printContext() {
        console.log("Context:", this.intraContextStack);
    }
};


export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode): Dependency[] {
	switch (node.type) {
        case "ThisExpression":
		case "Identifier": {
            const objNameContextList = trackers.getContextName(node.obj.name);
            const objName = node.obj.name;
            const depObjIds = trackers.getObjectVersions(objName, objNameContextList);

            // // this returns most recent version of object - may not be correct in every case
            // // for example if newer version is inside an if
			// return depObjIds.length > 0 ? [ DependencyFactory.DVar(objName, stmtId, depObjIds.slice(-1)[0]) ] : [ DependencyFactory.DEmpty() ];

            // this returns all version of the object. We may not need all in every case
            if (depObjIds.length > 0) {
                return depObjIds.map(depObjId => DependencyFactory.DVar(objName, stmtId, depObjId));
            }
            return [ DependencyFactory.DEmpty() ];

            // // this returns first version of object - does not make sense
			// return depObjIds.length > 0 ? [ DependencyFactory.DVar(objName, stmtId, depObjIds[0]) ] : [ DependencyFactory.DEmpty() ];
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
            const objName = obj.obj.name;
            const objNameContextList = trackers.getContextName(objName);
            const objNameContext = objNameContextList.slice(-1)[0];

            // if the member expression is computed  and is not a
            // Literal then we have to evaluate the dependencies
            // of the property as it is a variable,  because it
            // influences the object otherwise treat it is a Literal
            if (node.obj.computed && prop.type !== "Literal") {
                let deps = evalDep(trackers, stmtId, prop);
                let objIds = trackers.getObjectVersions(objName, objNameContextList);
                deps = [
                    ...deps,
                    ...objIds.map(objId => DependencyFactory.DObject("*", stmtId, objId, prop.obj.name))
                ];
                return deps;
                // // change propName to be '*' since the property is dynamic
                // propName = '*';
                // sourceObjName = prop.obj.name;
            }
            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the object
            const objIds = trackers.getObjectVersionsWithProp(objNameContext, prop.obj.name);
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

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageValue[] {
	switch (node.type) {
        case "ThisExpression":
		case "Identifier": {
            const objNameContext = trackers.getContextName(node.obj.name).slice(-1)[0];
			const locations = trackers.getStorage(objNameContext);
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
            const objNameContext = trackers.getContextName(obj.obj.name).slice(-1)[0];

            const stos = trackers.getPropStorage(objNameContext, prop.obj.name);
            return stos.length > 0 ? stos : [ StorageFactory.StoUnknown() ];
        }

        default: {
            return [ StorageFactory.StoUnknown() ];
        }
	}
}