import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";
import { clone, getASTNode, getAllASTNodes, getNextObjectName, ContextNames, copyObj } from "../../utils/utils";
import { Dependency, DependencyFactory } from "./dep_factory";
import { StorageObject, StorageValue, StorageFactory } from "./sto_factory";

export interface HeapObject {
    [key: string]: StorageValue,
}

interface ValidObject {
    name: string,
    storage: StorageValue[],
}

type Heap = Map<string, HeapObject>;
type Store = Map<string, StorageValue[]>;
type Phi = Map<string, number>;
type References = Map<string, string[]>;
type GNodes = Map<string, number>;
type FContexts = Map<number, number[]>;

export class DependencyTracker {
    private graph: Graph;
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private refs: References;
    private gNodes: GNodes;
    private funcContexts: FContexts;
    private intraContextStack: number[];

    constructor(graph: Graph) {
        this.graph = graph;
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.refs = new Map();
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

    getContextNameList(name: string, defaultContext: number): string[] {
        let latestContext = this.intraContextStack.slice(-1)[0] || defaultContext;
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

    graphCreateNewObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string): number {
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjName;

        // add create edge
        this.graph.addEdge(sourceId, nodeObj.id, { type: "REF", label: "", objName: objName });
        return nodeObj.id;
    }

    graphCreateParamObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string) {
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjName;

        this.graph.addEdge(this.graph.taintNode, nodeObj.id, { type: "PDG", label: "TAINT" });
        this.graph.addEdge(sourceId, nodeObj.id, { type: "REF", label: "", objName: objName });
    }

    graphCreateNewSubObject(sourceId: number, objects: string[], objName: string, propName: string, pdgObjName: string, pdgObjNameContext: string) {
        // this op must be written to gChanges first
        objects.forEach(obj => {
            const sourceObjId = this.gNodes.get(obj);
            const destinationObjId = this.gNodes.get(pdgObjName);
            // add create edge
            if (sourceObjId && destinationObjId) {
                this.graph.addEdge(sourceObjId, destinationObjId, { type: "SUB", label: "SUB_OBJECT", objName: propName });
            }
        });

        this.graphCreateParamObject(sourceId, objName, pdgObjName, pdgObjNameContext);
    }

    graphCreateNewObjectVersion(sourceId: number, srcLocation: string, dstLocation: string, dstLocationContext: string, deps: Dependency[], propName: string, sourceObjName?: string) {
        // create new version node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(dstLocationContext, nodeObj.id);
        nodeObj.identifier = dstLocation;

        // get id of object node (destination)
        const destinationNodeId = this.gNodes.get(dstLocationContext);
        // add write edge
        if (destinationNodeId) {
            this.graph.addEdge(sourceId, destinationNodeId, {
                type: "PDG",
                label: "WRITE",
                objName: propName,
                sourceObjName: sourceObjName
            });
        }

        // add new version edge
        const previousVersionId = this.gNodes.get(srcLocation);
        if (previousVersionId) {
            this.graph.addEdge(previousVersionId, nodeObj.id, {
                type: "PDG",
                label: "NEW_VERSION",
                objName: propName,
                sourceObjName: sourceObjName,
            });
        }

        deps.forEach(dep => {
            const name = dep.name || "";
            // add var dependency edge
            if (dep.source && dep.destination && dep.source !== dep.destination) {
                this.graph.addEdge(dep.source, dep.destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
            }
        });
    }

    graphBuildEdge(deps: Dependency[]) {
        deps.forEach(dep => {
            const name = dep.name || "";
            // add var dependency edge
            if (dep.source && dep.destination && dep.source !== dep.destination) {
                this.graph.addEdge(dep.source, dep.destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
            }
        });
    }

    graphBuildReferenceEdge(sourceId: number, variableName: string, location: string) {
        const locationId = this.gNodes.get(location);

        if (locationId && sourceId !== locationId) {
            this.graph.addEdge(sourceId, locationId, { type: "REF", label: "REF", objName: variableName });
        }
    }

    graphLookupObject(deps: Dependency[]) {
        deps.forEach(dep => {
            const propName = dep.name || "";

            if (DependencyFactory.isDVar(dep)) {
                const name = dep.name || "";
                // add var dependency edge
                if (dep.source && dep.destination && dep.source !== dep.destination) {
                    this.graph.addEdge(dep.source, dep.destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
                }
            } else {
                // add lookup edge
                if (dep.source && dep.destination) {
                    this.graph.addEdge(dep.source, dep.destination, {
                        type: "PDG",
                        label: "LOOKUP",
                        objName: propName,
                        sourceObjName: dep.sourceObjName,
                    });
                }
            }
        });
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

    getObjectVersionsWithProp(objName: string, functionContext: number, propName: string): number[] {
        // get version of object in storage
        const objNameContextList = this.getContextNameList(objName, functionContext);
        const validObj = this.getValidObject(objNameContextList);

        if (validObj) {
            const objStorage = validObj.storage;
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

    getValidObject(objNameContextList: string[]): ValidObject | undefined {
        for (let i = objNameContextList.length - 1; i >= 0; i--) {
            const objStorage = this.getStorage(objNameContextList[i]);
            if (objStorage) {
                return {
                    name: objNameContextList[i],
                    storage: objStorage,
                };
            }
        }
    }

    getObjectVersions(objName: string, funcContext: number): number[] {
        const objNameContextList = this.getContextNameList(objName, funcContext);
        const validObj = this.getValidObject(objNameContextList);

        if (validObj) {
            const objStorage = validObj.storage;
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
        const clone = new DependencyTracker(this.graph);
        clone.setHeap(this.heap);
        clone.setStore(this.store);
        clone.setPhi(this.phi);
        clone.setRefs(this.refs);
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


export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode, destinationId: number | undefined): Dependency[] {
	switch (node.type) {
        case "ThisExpression":
		case "Identifier": {
            const objName = node.obj.name;
            const depObjIds = trackers.getObjectVersions(objName, node.functionContext);
            // this returns all version of the object. We may not need all in every case
            if (depObjIds.length > 0) {
                if (destinationId) return depObjIds.map(depObjId => DependencyFactory.DVar(objName, depObjId, destinationId));
                return depObjIds.map(depObjId => DependencyFactory.DVar(objName, depObjId, stmtId));
            }
            return [ DependencyFactory.DEmpty() ];
		}

		case "Literal": {
            return [ DependencyFactory.DConst(node.obj.value, stmtId) ];
		}

        case "Property": {
            return evalDep(trackers, stmtId, getASTNode(node, "value"), destinationId);
        }

        case "BinaryExpression": {
            const leftDep = evalDep(trackers, stmtId, getASTNode(node, "left"), destinationId);
            const rightDep = evalDep(trackers, stmtId, getASTNode(node, "right"), destinationId)
            return [ leftDep, rightDep ].flat();
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objName = obj.obj.name;

            // if the member expression is computed  and is not a
            // Literal then we have to evaluate the dependencies
            // of the property as it is a variable,  because it
            // influences the object otherwise treat it is a Literal
            if (node.obj.computed && prop.type !== "Literal") {
                let deps = evalDep(trackers, stmtId, prop, destinationId);
                let objIds = trackers.getObjectVersions(objName, obj.functionContext);
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
            const objIds = trackers.getObjectVersionsWithProp(objName, obj.functionContext, prop.obj.name);
            return objIds.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId));
        }

        case "NewExpression":
        case "CallExpression": {
            const callee = getASTNode(node, "callee");
            const args = getAllASTNodes(node, "arg");
            let argDeps = args.map(arg => evalDep(trackers, stmtId, arg, destinationId)).flat();
            const calleeDeps = evalDep(trackers, stmtId, callee, destinationId).map(cd => {
                return DependencyFactory.isDVar(cd) ? DependencyFactory.changeToCalleeDep(cd) : cd;
            });
            return [...argDeps, ...calleeDeps];
        }

        case "TemplateLiteral": {
            return getAllASTNodes(node, "expression").map(exp => evalDep(trackers, stmtId, exp, destinationId)).flat();
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
            const objNameContext = trackers.getContextNameList(node.obj.name, node.functionContext).slice(-1)[0];
			const locations = trackers.getStorage(objNameContext);
            return locations ? locations.slice(-1) : [ StorageFactory.StoNoObject() ];
		}

		case "Literal": {
            return [ StorageFactory.StoNoObject() ];
		}

        case "BinaryExpression": {
            const leftSto = evalSto(trackers, getASTNode(node, "left"));
            const rightSto = evalSto(trackers, getASTNode(node, "right"));
            return [ ...leftSto, ...rightSto ];
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objNameContextList = trackers.getContextNameList(obj.obj.name, obj.functionContext);
            const validObj = trackers.getValidObject(objNameContextList);

            if (validObj) {
                const objNameContext = validObj.name;
                const stos = trackers.getPropStorage(objNameContext, prop.obj.name);
                return stos.length > 0 ? stos : [ StorageFactory.StoUnknown() ];
            }
            return [ StorageFactory.StoUnknown() ];
        }

        default: {
            return [ StorageFactory.StoUnknown() ];
        }
	}
}