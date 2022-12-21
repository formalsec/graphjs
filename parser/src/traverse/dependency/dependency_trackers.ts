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
    // private phi: Phi;
    private refs: References;
    private gNodes: GNodes;
    private funcContexts: FContexts;
    private intraContextStack: number[];

    constructor(graph: Graph) {
        this.graph = graph;
        this.heap = new Map();
        this.store = new Map();
        // this.phi = new Map();
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

    addParamNode(stmtId: number, name: string, nameContext: string) {
        // add to heap
        const { pdgObjName, pdgObjNameContext } = this.addNewObjectToHeap(name, nameContext);

        // store the identifier of the new object
        this.addToStore(nameContext, StorageFactory.StoObject(pdgObjNameContext));

        // // store the stmtid
        // this.addToPhi(nameContext, stmtId);

        // set changes as creation of new object
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjNameContext;

        // connect taint node
        this.graph.addEdge(this.graph.taintNode, nodeObj.id, { type: "PDG", label: "TAINT" });

        this.graphCreateReferenceEdge(stmtId, nodeObj.id);
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

//     addPropInHeap(name: string, propName: string, value: StorageObject) {
//         const heapValue = this.getHeapValue(name);
//         if (heapValue) {
//             heapValue[propName] = value;
//         } else {
//             const newHeapValue: HeapObject = {};
//             newHeapValue[propName] = value;
//             this.addToHeap(name, newHeapValue);
//         }
//     }

//     replacePropInHeap(name: string, propName: string, value: StorageObject) {
//         const heapValue = this.getHeapValue(name);
//         if (heapValue && propName in heapValue) {
//             heapValue[propName] = value;
//         }
//     }

    addToStore(name: string, location: StorageObject) {
        let storeArray = this.getStorage(name);
        if (!storeArray) {
            storeArray = [];
        }

        storeArray.push(location);

        this.addToRefs(location.location, name);
        this.store.set(name, storeArray);
    }

    addToRefs(location: string, name: string) {
        if (this.refs.has(location)) {
            this.refs.get(location)?.push(name);
        } else {
            this.refs.set(location, [name]);
        }
    }

//     addInStoreForAll(lastLocation: string, newLocation: StorageObject) {
//         const allRefs = this.refs.get(lastLocation);
//         allRefs?.forEach((name) => this.addToStore(name, newLocation));
//     }

    getLastObjectLocation(objName: string): string | undefined {
        const objLocations = this.getStorage(objName);

        if (objLocations) {
            const lastObjLocation = objLocations[objLocations.length - 1];
            const stoObj = lastObjLocation as StorageObject;
            return stoObj.location;
        }
    }

//     needNewObjectNode(name: string, right: GraphNode): boolean {
//         return this.getStorage(name) === undefined;
//     }

//     addToPhi(name: string, id: number) {
//         this.phi.set(name, id);
//     }

    graphCreateNewObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string): number {
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjNameContext;

        return nodeObj.id;
    }

    graphCreateReferenceEdge(source: number, destination: number) {
        // create ref edge
        this.graph.addEdge(source, destination, { type: "REF", label: "" });
    }

    graphCreateDependencyEdge(source: number, destination: number, dep: Dependency) {
        // create ref edge
        this.graph.addEdge(source, destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: dep.name });
    }

    graphCreateCallStatementDependencies(stmtId: number, newObjId: number, deps: Dependency[]) {
        const varDeps = deps.filter(dep => DependencyFactory.isDVar(dep));
        const calleeDeps = deps.filter(dep => DependencyFactory.isDCallee(dep));

        calleeDeps.forEach(dep => this.graphCreateReferenceEdge(stmtId, dep.source));
        varDeps.forEach(dep => this.graphCreateDependencyEdge(dep.source, newObjId, dep));
    }

    graphCreateMemberExpressionDependencies(stmtId: number, deps: Dependency[]) {
        const objDeps = deps.filter(dep => DependencyFactory.isDObject(dep));
        objDeps.forEach(dep => this.graphCreateReferenceEdge(stmtId, dep.source));
    }

    graphCreateNewVersionEdge(oldObjId: number, newObjId: number, propName: string) {
        // create new version edge
        this.graph.addEdge(oldObjId, newObjId, { type: "PDG", label: "NV", objName: propName });
    }

    graphCreateSubObjectEdge(objId: number, subObjId: number, propName: string) {
        // create new version edge
        this.graph.addEdge(objId, subObjId, { type: "PDG", label: "SO", objName: propName });
    }

//     graphCreateParamObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string) {
//         // create node
//         const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
//         this.gNodes.set(pdgObjNameContext, nodeObj.id);
//         nodeObj.identifier = pdgObjName;

//         this.graph.addEdge(this.graph.taintNode, nodeObj.id, { type: "PDG", label: "TAINT" });
//         this.graph.addEdge(sourceId, nodeObj.id, { type: "REF", label: "", objName: objName });
//     }

//     graphCreateNewSubObject(sourceId: number, objects: string[], objName: string, propName: string, pdgObjName: string, pdgObjNameContext: string) {
//         const subObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
//         this.gNodes.set(pdgObjNameContext, subObj.id);
//         subObj.identifier = pdgObjName;

//         // this op must be written to gChanges first
//         objects.forEach(obj => {
//             const sourceObjId = this.gNodes.get(obj);
//             // add create edge
//             if (sourceObjId) {
//                 this.graph.addEdge(sourceObjId, subObj.id, { type: "SUB", label: "SO", objName: propName });
//             }
//         });
//     }

//     graphCreateNewObjectVersion(sourceId: number, srcLocation: string, dstLocation: string, dstLocationContext: string, deps: Dependency[], propName: string, sourceObjName?: string) {
//         // create new version node
//         const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
//         this.gNodes.set(dstLocationContext, nodeObj.id);
//         nodeObj.identifier = dstLocation;

//         // // get id of object node (destination)
//         // const destinationNodeId = this.gNodes.get(dstLocationContext);
//         // // add write edge
//         // if (destinationNodeId) {
//         //     this.graph.addEdge(sourceId, destinationNodeId, {
//         //         type: "PDG",
//         //         label: "WRITE",
//         //         objName: propName,
//         //         sourceObjName: sourceObjName
//         //     });
//         // }

//         // this op must be written to gChanges first
//         const destinationObjId = this.gNodes.get(propName);
//         // add create edge
//         if (destinationObjId) {
//             this.graph.addEdge(nodeObj.id, destinationObjId, { type: "SUB", label: "SUB_OBJECT", objName: propName });
//         }

//         // add new version edge
//         const previousVersionId = this.gNodes.get(srcLocation);
//         if (previousVersionId) {
//             this.graph.addEdge(previousVersionId, nodeObj.id, {
//                 type: "PDG",
//                 label: "NEW_VERSION",
//                 objName: propName,
//                 sourceObjName: sourceObjName,
//             });
//         }

//         // deps.forEach(dep => {
//         //     const name = dep.name || "";
//         //     // add var dependency edge
//         //     if (dep.source && dep.destination && dep.source !== dep.destination) {
//         //         this.graph.addEdge(dep.source, dep.destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
//         //     }
//         // });
//     }

//     graphBuildEdge(deps: Dependency[], destinationId: number) {
//         deps.forEach(dep => {
//             const name = dep.name || "";
//             // add var dependency edge
//             if (dep.source && dep.source !== destinationId) {
//                 this.graph.addEdge(dep.source, destinationId, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
//             }
//         });
//     }

//     graphBuildReferenceEdge(sourceId: number, variableName: string, destinationId: number) {
//         if (sourceId !== destinationId) {
//             this.graph.addEdge(sourceId, destinationId, { type: "REF", label: "", objName: variableName });
//         }
//     }

//     graphBuildReferenceEdgeLocation(sourceId: number, variableName: string, location: string) {
//         const locationId = this.gNodes.get(location);

//         if (locationId && sourceId !== locationId) {
//             this.graph.addEdge(sourceId, locationId, { type: "REF", label: "", objName: variableName });
//         }
//     }

//     graphLookupObject(deps: Dependency[]) {
//         deps.forEach(dep => {
//             const propName = dep.name || "";

//             if (DependencyFactory.isDVar(dep)) {
//                 const name = dep.name || "";
//                 // add var dependency edge
//                 if (dep.source && dep.destination && dep.source !== dep.destination) {
//                     this.graph.addEdge(dep.source, dep.destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: name });
//                 }
//             } else {
//                 // add lookup edge
//                 if (dep.source && dep.destination) {
//                     this.graph.addEdge(dep.source, dep.destination, {
//                         type: "PDG",
//                         label: "LOOKUP",
//                         objName: propName,
//                         sourceObjName: dep.sourceObjName,
//                     });
//                 }
//             }
//         });
//     }

    private setHeap(newHeap: Heap) {
        this.heap = new Map(newHeap);
    }

    private setStore(newStore: Store) {
        this.store = new Map(newStore);
    }

    // private setPhi(newPhi: Phi) {
    //     this.phi = new Map(newPhi);
    // }

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

//     getStatementId(key: string): number | undefined {
//         return this.phi.get(key);
//     }

    getObjectId(key: string): number | undefined {
        return this.gNodes.get(key);
    }

    getObjectVersionsWithProp(objName: string, functionContext: number, propName: string): number[] {
        const objIds: number[] = [];

        // get version of object in storage
        // account for previous contexts
        const objNameContextList = this.getContextNameList(objName, functionContext);

        // get valid object according to context
        const validObj = this.getValidObject(objNameContextList);

        if (validObj) {
            const objects = validObj.storage;

            objects.forEach(obj => {
                if (obj && StorageFactory.isStorageObject(obj)) {
                    const location = (<StorageObject>obj).location;
                    const value = this.getHeapValue(location);

                    if (value && propName in value) {
                        const propLocation = StorageFactory.isStorageObject(value[propName]) ? <StorageObject>value[propName] : undefined;
                        const objId = propLocation ? this.getObjectId(propLocation.location) : undefined;
                        if (objId) objIds.push(objId);
                    }
                }
            });
        }

        return objIds;
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
            // get those that have the property in the name
            const objValues: StorageValue[] = [];

            objStorage.forEach(o => {
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

//     createNewObjectVersion(stmtId: number, objName: string, objNameContext: string, propName: string, propValue: StorageValue) {
//         const newTrackers = this.clone();

//         const lastObjLocation = this.getLastObjectLocation(objNameContext);

//         if (lastObjLocation) {
//             const locationHeapValue = clone(this.getHeapValue(lastObjLocation));

//             if (locationHeapValue) {
//                 const { pdgObjName, pdgObjNameContext } = newTrackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);

//                 let newPropValue = propValue;
//                 // if (!StorageFactory.isStorageObject(propValue)) {
//                 //     newPropValue = newTrackers.createObjectProperties(stmtId, objName, objNameContext, propName);
//                 // }

//                 newPropValue = newTrackers.createObjectProperties(stmtId, objName, objNameContext, propName);

//                 locationHeapValue[propName] = newPropValue;

//                 newTrackers.addInStoreForAll(lastObjLocation, StorageFactory.StoObject(pdgObjNameContext));

//                 return {
//                     newTrackers,
//                     newObjLocation: pdgObjName,
//                     newObjLocationContext: pdgObjNameContext,
//                 };
//             }
//         }

//         return {
//             newTrackers,
//             newObjLocation: objName,
//             newObjLocationContext: objNameContext,
//         };
//     }

//     createArrayElementInHeap(stmtId: number, objName: string, objNameContext: string, elementIndex: number, propValue: StorageValue) {
//         const lastLocation = this.getLastObjectLocation(objNameContext);

//         if (lastLocation) {
//             const locationHeapValue = clone(this.getHeapValue(lastLocation));

//             if (locationHeapValue) {
//                 let newPropValue: StorageValue | undefined = propValue;
//                 // if (!StorageFactory.isStorageObject(propValue)) {
//                 //     newPropValue = this.createObjectProperties(stmtId, objName, objNameContext, elementIndex.toString());
//                 // }

//                 newPropValue = this.createObjectProperties(stmtId, objName, objNameContext, elementIndex.toString());
//                 if (newPropValue) {
//                     locationHeapValue[elementIndex] = newPropValue;
//                     this.addToHeap(lastLocation, locationHeapValue);
//                 }
//             }
//         }
//     }

//     createObjectProperties(stmtId: number, objName: string, objNameContext: string, propName: string): StorageValue {
//         // get version of object in storage
//         const objStorage = this.getStorage(objNameContext);

//         if (objStorage) {
//             const objNameProperty = `${objName}.${propName}`;
//             const objNameContextProperty = `${objNameContext}.${propName}`;
//             const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (<StorageObject>sto).location);
//             const { pdgObjName, pdgObjNameContext } = this.addNewObjectToHeap(objNameProperty, objNameContextProperty);
//             this.graphCreateNewSubObject(stmtId, objects, objNameProperty, propName, pdgObjName, pdgObjNameContext);

//             const propStorage = StorageFactory.StoObject(pdgObjNameContext);
//             objects.forEach(o => {
//                 const value = this.getHeapValue(o);
//                 if (value) {
//                     // set changes as creation of new object
//                     value[propName] = propStorage;
//                 }
//             });
//             return propStorage;
//         }

//         return {};
//     }

    clone(): DependencyTracker {
        const clone = new DependencyTracker(this.graph);
        clone.setHeap(this.heap);
        clone.setStore(this.store);
        // clone.setPhi(this.phi);
        clone.setRefs(this.refs);
        clone.setGNodes(this.gNodes);
        clone.setFuncContexts(this.funcContexts);
        clone.setContext(this.intraContextStack);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        // console.log("Phi:", this.phi);
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
            const objName = node.obj.name;
            const depObjId = trackers.getObjectVersions(objName, node.functionContext).slice(-1)[0];

            return [ DependencyFactory.DVar(objName, depObjId) ];
		}

		// case "Literal": {
        //     return [ DependencyFactory.DConst(node.obj.value, stmtId) ];
		// }

        // case "Property": {
        //     return evalDep(trackers, stmtId, getASTNode(node, "value"), destinationId);
        // }

        case "BinaryExpression": {
            const leftDep = evalDep(trackers, stmtId, getASTNode(node, "left"));
            const rightDep = evalDep(trackers, stmtId, getASTNode(node, "right"));
            return [ leftDep, rightDep ].flat();
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objName = obj.obj.name;

            // // if the member expression is computed  and is not a
            // // Literal then we have to evaluate the dependencies
            // // of the property as it is a variable,  because it
            // // influences the object otherwise treat it is a Literal
            // if (node.obj.computed && prop.type !== "Literal") {
            //     let deps = evalDep(trackers, stmtId, prop);
            //     let objIds = trackers.getObjectVersions(objName, obj.functionContext);
            //     deps = [
            //         ...deps,
            //         ...objIds.map(objId => DependencyFactory.DObject("*", stmtId, objId, prop.obj.name))
            //     ];
            //     return deps;
            // }

            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the object
            const objIds = trackers.getObjectVersionsWithProp(objName, obj.functionContext, prop.obj.name);
            return objIds.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId));
        }

        case "NewExpression":
        case "CallExpression": {
            const callee = getASTNode(node, "callee");
            const args = getAllASTNodes(node, "arg");

            // get all argument dependencies
            let argDeps = args.map(arg => evalDep(trackers, stmtId, arg)).flat();

            // get callee dependencies
            const calleeDeps = evalDep(trackers, stmtId, callee).map(cd => {
                return DependencyFactory.isDVar(cd) ? DependencyFactory.changeToCalleeDep(cd) : cd;
            });

            // return all dependencies
            return [...argDeps, ...calleeDeps];
        }

        // case "TemplateLiteral": {
        //     return getAllASTNodes(node, "expression").map(exp => evalDep(trackers, stmtId, exp, destinationId)).flat();
        // }

		default: {
			return [];
		}
	}
}

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageValue[] {
	switch (node.type) {
        case "ThisExpression":
		case "Identifier": {
            const objNameContext = trackers.getContextNameList(node.obj.name, node.functionContext).slice(-1)[0];
			const locations = trackers.getStorage(objNameContext);
            return locations ? locations.slice(-1) : [];
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
                return trackers.getPropStorage(objNameContext, prop.obj.name);
            }
            return [];
        }

        default: {
            return [];
        }
	}
}