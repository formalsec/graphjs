import { type Graph } from "../graph/graph";
import { type GraphNode } from "../graph/node";
import { getASTNode, getAllASTNodes, getNextObjectName, type ContextNames, deepCopyStore } from "../../utils/utils";
import { type Dependency, DependencyFactory } from "./dep_factory";
import { type StorageObject, type StorageValue, StorageFactory } from "./sto_factory";

export type HeapObject = Record<string, StorageValue>;

interface ValidObject {
    name: string
    storage: StorageValue[]
}

type Heap = Map<string, HeapObject>;
export type Store = Map<string, StorageValue[]>;
type References = Map<string, string[]>;
type GNodes = Map<string, number>;
type FContexts = Map<number, number[]>;

export class DependencyTracker {
    // This value represents the current state of the graph
    private graph: Graph;
    // This value represents TODO
    private heap: Heap;
    // This value represents TODO
    private store: Store;
    // This value represents TODO
    private refs: References;
    // This value represents TODO
    private gNodes: GNodes;
    // This value represents TODO
    private funcContexts: FContexts;
    // This value represents TODO
    private intraContextStack: number[];

    constructor(graph: Graph) {
        this.graph = graph;
        this.heap = new Map();
        this.store = new Map();
        this.refs = new Map();
        this.gNodes = new Map();
        this.funcContexts = new Map();
        this.intraContextStack = new Array<number>();
    }

    private setHeap(newHeap: Heap): void {
        this.heap = new Map(newHeap);
    }

    private setRefs(newRefs: References): void {
        this.refs = new Map(newRefs);
    }

    private setGNodes(newGNodes: GNodes): void {
        this.gNodes = new Map(newGNodes);
    }

    private setFuncContexts(newFuncContext: FContexts): void {
        this.funcContexts = new Map(newFuncContext);
    }

    private setContext(newContext: number[]): void {
        const newContextArray = new Array<number>();
        newContext.forEach(c => newContextArray.push(c));
        this.intraContextStack = newContextArray;
    }

    /** Context functions **/
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

    pushIntraContext(context: number): void {
        this.intraContextStack.push(context);
    }

    popIntraContext(): number | undefined {
        return this.intraContextStack.pop();
    }

    getContextNameList(name: string, defaultContext: number): string[] {
        const latestContext = this.intraContextStack.slice(-1)[0] || defaultContext;
        const contextList = this.funcContexts.get(latestContext);
        return contextList ? [...contextList, latestContext].map(ctx => `${ctx}.${name}`) : [`${latestContext.toString()}.${name}`];
    }

    /** Methods for adding edges in the graph **/

    graphCreateReferenceEdge(source: number, destination: number, label: string = ""): void {
        this.graph.addEdge(source, destination, { type: "REF", label });
    }

    graphCreateDependencyEdge(source: number, destination: number, dep: Dependency): void {
        this.graph.addEdge(source, destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: dep.name });
    }

    graphCreateSourceEdge(source: number, destination: number, index: number): void {
        this.graph.addEdge(source, destination, { type: "REF", label: "param", paramIndex: index })
    }

    graphCreateSinkEdge(source: number, destination: number, type: string): void {
        this.graph.addEdge(source, destination, { type: "SINK", label: "SINK", objName: type })
    }

    graphCreateReturnEdge(source: number, destination: number): void {
        this.graph.addEdge(source, destination, { type: "REF", label: "RET" });
    }

    graphCreateNewVersionEdge(oldObjId: number, newObjId: number, propName: string): void {
        this.graph.addEdge(oldObjId, newObjId, { type: "PDG", label: "NV", objName: propName });
    }

    graphCreateSubObjectEdge(objId: number, subObjId: number, propName: string, deps: Dependency[] = []): void {
        this.graph.addEdge(objId, subObjId, { type: "PDG", label: "SO", objName: propName });

        // if we are writing all possible subObject
        if (propName === '*') {
            const objNode = this.graph.nodes.get(objId);
            deps.filter(dep => DependencyFactory.isDVar(dep)).forEach(dep => objNode?.addWriteAllSubObjects(dep));
        }
    }

    graphCreateCallStatementDependencyEdges(stmtId: number, newObjId: number, deps: Dependency[]): void {
        const varDeps = deps.filter(dep => DependencyFactory.isDVar(dep));
        const calleeDeps = deps.filter(dep => DependencyFactory.isDCallee(dep));

        calleeDeps.forEach(dep => { this.graphCreateReferenceEdge(stmtId, dep.source); });
        varDeps.forEach(dep => { this.graphCreateDependencyEdge(dep.source, newObjId, dep); });
    }

    graphCreateMemberExpressionDependencies(stmtId: number, newObjId: number, deps: Dependency[]): void {
        deps
            .filter(dep => DependencyFactory.isDObject(dep))
            .forEach(dep => { this.graphCreateReferenceEdge(stmtId, dep.source); });

        deps
            .filter(dep => DependencyFactory.isDVar(dep))
            .forEach(dep => { this.graphCreateDependencyEdge(dep.source, newObjId, dep); });
    }

    /** Methods for adding nodes **/
    addParamNode(stmtId: number, name: string, nameContext: string, index: number): void {
        // add to heap
        const { pdgObjName, pdgObjNameContext } = this.addNewObjectToHeap(name, nameContext);

        // store the identifier of the new object
        this.addToStore(nameContext, StorageFactory.StoObject(pdgObjNameContext));

        // // store the stmt id
        // this.addToPhi(nameContext, stmtId);

        // set changes as creation of new object
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjNameContext;

        // connect taint node
        this.graph.addEdge(this.graph.taintNode, nodeObj.id, { type: "PDG", label: "TAINT" });

        this.graphCreateSourceEdge(stmtId, nodeObj.id, index);
    }

    /** Sink node methods **/
    graphCheckSinkNode(sink: string): number | undefined {
        return this.graph.sinkNodes.get(sink);
    }

    graphAddSinkNode(sink: string): GraphNode {
        return this.graph.addSinkNode(sink);
    }

    graphConnectToSinkNode(source: number, sourceName: string, sinkNode: number): void {
        this.graph.addEdge(source, sinkNode, { type: "PDG", label: "DEP", objName: sourceName });
    }

    /** Get object information **/

    getObjectId(key: string): number | undefined {
        return this.gNodes.get(key);
    }

    /* Gets version of object from previous contexts */
    getValidObject(objNameContextList: string[]): ValidObject | undefined {
        for (let i = objNameContextList.length - 1; i >= 0; i--) {
            const objStorage = this.getStorage(objNameContextList[i]);
            if (objStorage) {
                return {
                    name: objNameContextList[i],
                    storage: objStorage
                };
            }
        }
    }

    /* Gets most recent version of the object */
    getLastObjectLocation(objName: string): string | undefined {
        const objLocations = this.getStorage(objName);

        if (objLocations) {
            const lastObjLocation = objLocations[objLocations.length - 1];
            const stoObj = lastObjLocation as StorageObject;
            return stoObj.location;
        }
    }

    /** Object creation **/
    graphCreateNewObject(sourceId: number, objName: string, pdgObjName: string, pdgObjNameContext: string): number {
        // create node
        const nodeObj = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        this.gNodes.set(pdgObjNameContext, nodeObj.id);
        nodeObj.identifier = pdgObjNameContext;

        return nodeObj.id;
    }

    /** Heap manipulation functions **/
    getHeapValue(key: string): HeapObject | undefined {
        return this.heap.get(key);
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

    addToHeap(name: string, heapObject: HeapObject): void {
        this.heap.set(name, heapObject);
    }

    /** Store manipulation functions **/
    getStorage(key: string): StorageValue[] | undefined {
        return this.store.get(key);
    }

    setStore(newStore: Store): void {
        this.store = deepCopyStore(newStore);
    }

    addToStore(name: string, location: StorageObject): void {
        let storeArray = this.getStorage(name);
        if (!storeArray) {
            storeArray = [];
        }

        storeArray.push(location);

        this.addToRefs(location.location, name);
        this.store.set(name, storeArray);
    }

    addInStoreForAll(lastLocation: string, newLocation: StorageObject): void {
        const allRefs = this.refs.get(lastLocation);
        allRefs?.forEach((name) => { this.addToStore(name, newLocation); });
    }

    mergeStores(storeA: Store, storeB: Store): Store {
        const mergedStore = deepCopyStore(storeA);
        const mergedKeys = Array.from(mergedStore.keys());

        storeB.forEach((value: StorageValue[], key: string) => {
            if (!mergedKeys.includes(key)) {
                // include all pairs in storeB that were not in storeA
                mergedStore.set(key, value);
            } else {
                // include all storage values in storeB that were not in storeA for this key
                const mergedLocs = mergedStore.get(key);
                value.forEach((s: StorageValue) => {
                    if (mergedLocs && StorageFactory.isStorageObject(s) && !StorageFactory.includes(s as StorageObject, mergedLocs)) {
                        mergedStore.set(key, [...mergedLocs, s])
                    }
                });
            }
        });
        return mergedStore;
    }

    /** References manipulation functions **/
    addToRefs(location: string, name: string): void {
        if (this.refs.has(location)) {
            this.refs.get(location)?.push(name);
        } else {
            this.refs.set(location, [name]);
        }
    }

    /** **/

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
                    const location = (obj as StorageObject).location;
                    const value = this.getHeapValue(location);

                    if (value && propName in value) {
                        const propLocation = StorageFactory.isStorageObject(value[propName]) ? value[propName] as StorageObject : undefined;
                        const objId = propLocation ? this.getObjectId(propLocation.location) : undefined;
                        if (objId) objIds.push(objId);
                    }
                }
            });
        }

        return Array.from(new Set(objIds));
    }

    getObjectVersions(objName: string, funcContext: number): number[] {
        const objNameContextList = this.getContextNameList(objName, funcContext);
        const validObj = this.getValidObject(objNameContextList);

        if (validObj) {
            const objStorage = validObj.storage;
            // filter those versions that are not objects
            const objects = objStorage.filter(sto => StorageFactory.isStorageObject(sto)).map(sto => (sto as StorageObject).location);
            const objIds = objects.map(o => this.getObjectId(o)) as number[];
            return objIds;
        }

        return [];
    }

    getObjectVersionNodes(objName: string, funcContext: number): GraphNode[] {
        const objIds = this.getObjectVersions(objName, funcContext);
        const objs: GraphNode[] = [];
        objIds.forEach(objId => {
            const n = this.graph.nodes.get(objId);
            if (n) objs.push(n);
        });
        return objs;
    }

    getPropStorage(objName: string, propName: string): StorageValue[] {
        // get version of object in storage
        const objStorage = this.getStorage(objName);

        if (objStorage) {
            // get those that have the property in the name
            const objValues: StorageValue[] = [];

            objStorage.forEach(o => {
                const sto = o as StorageObject;

                const value = this.getHeapValue(sto.location);
                if (value && propName in value) {
                    objValues.push(value[propName]);
                }
            });

            return objValues;
        }

        return [];
    }

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

    storeSnapshot(): Store {
        return deepCopyStore(this.store);
    }

    print(): void {
        console.log("\nHeap:", this.heap);
        console.log("Store:", this.store);
        console.log("Refs:", this.refs);
        console.log("Graph Nodes:", this.gNodes);
        console.log("Func Contexts:", this.funcContexts);
    }

    printContext(): void {
        console.log("Context:", this.intraContextStack);
    }
}

export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode, arg?: number): Dependency[] {
    switch (node.type) {
        case "Literal":
            return [];

        case "ThisExpression":
        case "Identifier": {
            const objName = node.obj.name;
            const depObjId = trackers.getObjectVersions(objName, node.functionContext).slice(-1)[0];

            if (arg) {
                return [DependencyFactory.DVar(objName, depObjId, arg)];
            }

            return [DependencyFactory.DVar(objName, depObjId)];
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
            return [leftDep, rightDep].flat();
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objName = obj.obj.name;

            const latestObj = trackers.getObjectVersionNodes(objName, obj.functionContext).slice(-1)[0];
            let deps: Dependency[] = [];

            if (latestObj && latestObj.writeAllSubObjects.length > 0) {
                deps = latestObj.writeAllSubObjects;
            }

            // if the member expression is computed  and is not a
            // Literal then we have to evaluate the dependencies
            // of the property as it is a variable,  because it
            // influences the object otherwise treat it is a Literal
            if (node.obj.computed && prop.type !== "Literal") {
                // let deps = evalDep(trackers, stmtId, prop);
                const objIds = trackers.getObjectVersions(objName, obj.functionContext);
                deps = [
                    ...deps
                    // ...objIds.map(objId => DependencyFactory.DObject("*", stmtId, objId))
                ];
                return deps;
            }

            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the object
            const objIdsProp = trackers.getObjectVersionsWithProp(objName, obj.functionContext, prop.obj.name);
            deps = [
                ...deps,
                ...objIdsProp.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId))
            ]
            return deps;
        }

        case "NewExpression":
        case "CallExpression": {
            const callee = getASTNode(node, "callee");
            const args = getAllASTNodes(node, "arg");

            // get all argument dependencies
            const argDeps = args.map((arg, i) => evalDep(trackers, stmtId, arg, i + 1)).flat();

            // get callee dependencies
            const calleeDeps = evalDep(trackers, stmtId, callee).map(cd => {
                return DependencyFactory.isDVar(cd) ? DependencyFactory.changeToCalleeDep(cd) : cd;
            });

            // return all dependencies
            return [...argDeps, ...calleeDeps];
        }

        case "TemplateLiteral": {
            return getAllASTNodes(node, "expression").map((arg, i) => evalDep(trackers, stmtId, arg, i + 1)).flat();
        }

        default: {
            console.trace(`Expression ${node.type} didn't match with case values.`);
            return [];
        }
    }
}

export function evalSto(trackers: DependencyTracker, node: GraphNode): StorageValue[] {
    switch (node.type) {
        case "Literal":
            return [{}];

        case "ThisExpression":
        case "Identifier": {
            const objNameContext = trackers.getContextNameList(node.obj.name, node.functionContext).slice(-1)[0];
            const locations = trackers.getStorage(objNameContext);
            return locations ? locations.slice(-1) : [{}];
        }

        case "BinaryExpression": {
            const leftSto = evalSto(trackers, getASTNode(node, "left"));
            const rightSto = evalSto(trackers, getASTNode(node, "right"));
            return [...leftSto, ...rightSto];
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objNameContextList = trackers.getContextNameList(obj.obj.name, obj.functionContext);
            const validObj = trackers.getValidObject(objNameContextList);

            if (validObj) {
                const objNameContext = validObj.name;
                // if expression is computed and property is not a Literal, need to get dynamic property
                if (node.obj.computed && prop.type !== "Literal") {
                    return trackers.getPropStorage(objNameContext, '*');
                }
                return trackers.getPropStorage(objNameContext, prop.obj.name);
            }
            return [{}];
        }

        default: {
            console.trace(`Expression ${node.type} didn't match with case values.`);
            return [{}];
        }
    }
}
