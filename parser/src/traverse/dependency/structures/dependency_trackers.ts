import { type Graph } from "../../graph/graph";
import { type GraphNode } from "../../graph/node";
import {
    getASTNode,
    getAllASTNodes,
    getNextLocationName,
    deepCopyStore,
} from "../../../utils/utils";
import * as DependencyFactory from "../dep_factory";
import { type Dependency } from "../dep_factory";
import { type Identifier } from "estree";
import { GraphEdge } from "../../graph/edge";

export type Store = Map<string, number[]>;
type FContexts = Map<number, number[]>;

type RequireChain = Map<string, string[]>;
type VPMap = Map<string, string>;

export class DependencyTracker {
    // This value represents the current state of the graph
    private readonly graph: Graph;
    // This value represents TODO
    private store: Store;
    // This value represents TODO
    private readonly funcContexts: FContexts;
    // This value represents TODO
    private intraContextStack: number[];
    // This value represents the anonymous functions that exist inside a function declaration and a mapping to their arguments
    // private anonFuncMapping: AnonFunctionMapping;
    // This value represents chains of "request" dependencies
    private requireChain: RequireChain;
    // This value represents a map of variable name to package name
    private variableMap: VPMap;

    constructor(graph: Graph, functionContexts: FContexts) {
        this.graph = graph;
        this.store = new Map();
        this.funcContexts = functionContexts;
        this.intraContextStack = new Array<number>();
        this.requireChain = new Map();
        this.variableMap = new Map();
    }

    private setContext(newContext: number[]): void {
        const newContextArray = new Array<number>();
        newContext.forEach(c => newContextArray.push(c));
        this.intraContextStack = newContextArray;
    }

    private setRequireChain(newRequireChain: RequireChain): void {
        this.requireChain = new Map(newRequireChain);
    }

    private setVariableMap(newVariableMap: VPMap): void {
        this.variableMap = new Map(newVariableMap);
    }

    pushIntraContext(context: number): void {
        this.intraContextStack.push(context);
    }

    popIntraContext(): number | undefined {
        return this.intraContextStack.pop();
    }

    addRequireChainEntry(variableName: string, packageName: string): void {
        const pChain = this.requireChain.get(packageName);
        let pChainValue: string[] = [variableName];
        if (pChain) pChainValue = [...pChain, variableName];
        this.requireChain.set(packageName, pChainValue);
        this.addVariableMap(variableName, packageName);
    }

    addVariableMap(variableName: string, functionMap: string): void {
        this.variableMap.set(variableName, functionMap);
    }

    checkVariableMap(variableName: string): string | undefined {
        return this.variableMap.get(variableName);
    }


    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------- STORE OPERATIONS ----------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    storeAddLocation(objName: string, location: number, context: number) {
        // Check if object exists
        const objContextName: string = `${context}.${objName}`
        const objectExists: boolean = this.store.has(objContextName)

        // If object exists, add new location
        if (objectExists) {
            const objectLocations: number[] = this.store.get(objContextName) ?? []
            if (!objectLocations.includes(location)) {
                objectLocations.push(location)
                this.store.set(objContextName, objectLocations)
            }
        }
        else {
            this.store.set(objContextName, [location])
        }
    }

    /* This function returns an object locations */
    getObjectLocationsFromStore(name: string, context: number | undefined = undefined): number[] {
        // 1. Get contexts where object with name "name" exist
        let objectContexts: string[]
        if (context) {
            const functionContexts: number[] = this.funcContexts.get(context) ?? []
            objectContexts = [context, ...functionContexts].map((ctx: number) => `${ctx}.${name}`) ?? []
        } else {
            objectContexts = this.intraContextStack.map((ctx: number) => `${ctx}.${name}`)
        }
        const validObjectContexts = objectContexts.filter((obj: string) => this.store.has(obj))

        // 2. Choose last context
        const lastObject = validObjectContexts.pop()

        // 3. Get list of object locations
        if (lastObject) {
            return this.store.get(lastObject) ?? []
        }
        return []
    }

    setStore(newStore: Store): void {
        this.store = deepCopyStore(newStore);
    }

    mergeStores(storeA: Store, storeB: Store): Store {
        const mergedStore: Store = deepCopyStore(storeA);
        const mergedKeys: string[] = Array.from(mergedStore.keys());

        storeB.forEach((value: number[], key: string) => {
            if (!mergedKeys.includes(key)) {
                // include all pairs in storeB that were not in storeA
                mergedStore.set(key, value);
            } else {
                // include all storage values in storeB that were not in storeA for this key
                const mergedLocs: number[] | undefined = mergedStore.get(key);
                value.forEach((s: number) => {
                    if (mergedLocs && !mergedLocs.includes(s)) {
                        mergedStore.set(key, [...mergedLocs, s])
                    }
                });
            }
        });
        return mergedStore;
    }

    storeSnapshot(): Store {
        return deepCopyStore(this.store);
    }


    // ------------------------------------------------------------------------------------------------------------ //
    // ---------------------------------------- GRAPH OPERATIONS -------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    graphAddLocation(objName: string, context: number): GraphNode {
        // Create location
        const locationName: string = getNextLocationName(objName, context)
        const nodeLocation: GraphNode = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        nodeLocation.identifier = locationName;

        // Create reference edge
        return nodeLocation;
    }

    // Get property location (return undefined when it does not exist)
    graphGetObjectPropertyLocation(objectLocation: number, property: string): GraphNode | undefined {
        // 1. Get graph node of object obj
        const graphObjectNode: GraphNode | undefined = this.graph.nodes.get(objectLocation)
        if (!graphObjectNode) { /* TODO: Output error */ }

        // 2. Get property edges
        const propertyEdges: GraphEdge[] | undefined = graphObjectNode?.edges
            .filter((edge: GraphEdge) => edge.type === "PDG" && edge.label === "SO" && edge.objName === property)

        if (propertyEdges && propertyEdges.length > 1)  { /* TODO: Output error */ }

        else if (propertyEdges) {
            return propertyEdges.pop()?.nodes[1]
        }
        else {
            return undefined
        }
    }

    graphGetObjectVersionsPropertyLocations(objName: string, context: number, propName: string): number[] {
        const locations: number[] = this.getObjectVersions(objName,context)

        const propertyLocations: number[] = []
        locations.forEach((location: number) => {
            const propertyLocation: number | undefined = this.graphGetObjectPropertyLocation(location, propName)?.id
            if (propertyLocation) {
                propertyLocations.push((propertyLocation))
            }
        })
        return propertyLocations;
    }

    graphGetNode(location: number): GraphNode | undefined {
        return this.graph.nodes.get(location)
    }
    // ------------------------------------------------------------------------------------------------------------ //
    // ---------------------------------------- AUXILIARY OPERATIONS ----------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /* This adds the new property to the object locations */
    addProp(locations: number[], objectName: string, property: string, context: number, stmtId: number): number[] {
        let propertyLocations: number[] = []
        // For each location
        locations.forEach((location: number) => {
            // 1. Check if property exists
            let propertyLocation = this.graphGetObjectPropertyLocation(location, property)

            // 2. If property does not exist, need to create the object property
            if (!propertyLocation) {
                // 2.1 Add property location to graph
                propertyLocation = this.graphAddLocation(`${objectName}.${property}`, context)
                this.graphCreatePropertyEdge(location, propertyLocation.id, property);
                this.graphCreateReferenceEdge(stmtId, propertyLocation.id)

                // 2.2 Add property location to store
                this.storeAddLocation(objectName, location, context)
            }
            // Add property location to array
            propertyLocations.push(propertyLocation.id)
        })
        return propertyLocations;
    }

    createNewObject(stmtId: number, functionContext: number, variable: Identifier): number {
        // Create location
        const location = this.graphAddLocation(variable.name, functionContext)

        // Add to store
        this.storeAddLocation(variable.name, location.id, functionContext)

        // Add reference edge
        this.graphCreateReferenceEdge(stmtId, location.id);

        return location.id;
    }

    addVersion(stmtId: number, objName: string, context: number, propName: string, deps: Dependency[]): void {
        const objectLocations: number[] = this.getObjectLocationsFromStore(objName, context)

        // 1. Create new version locations
        const newLocations: number[] =  []
        objectLocations.forEach((location: number) => {
            const newLocation: GraphNode = this.graphAddLocation(objName, context);
            this.graphCreateNewVersionEdge(location, newLocation.id, propName);
            newLocations.push(newLocation.id)
        })

        // 2. Update store for locations
        newLocations.forEach((location: number) => {
            this.storeAddLocation(objName, location, context);
        })

        // 3. Add property (locations and store)
        const propertyLocations: number[] = this.addProp(newLocations, objName, propName, context, stmtId)

        // Process dependencies of the right side of the assignment
        deps.forEach(dep => {
            propertyLocations.forEach((id: number) => {
                this.graphCreateDependencyEdge(dep.source, id, dep); });
        })
    }

    getObjectVersions(objName: string, context: number): number[] {
        const locations: number[] = this.getObjectLocationsFromStore(objName,context)

        const objectVersions: number[] = [...locations]
        locations.forEach((location: number) => {
            const locationNode: GraphNode | undefined = this.graph.nodes.get(location)
            if (locationNode) {
                const newVersionLocations: number[] = locationNode.edges
                    .filter((edge : GraphEdge) => edge.type === "PDG" && edge.label === "NV")
                    .map((edge: GraphEdge) => edge.nodes[1].id)
                objectVersions.push(...newVersionLocations)
            }
        })
        return objectVersions;
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    isInnerFunction(funcContextNumber: number): boolean {
        const contexts = this.funcContexts.get(funcContextNumber)
        return contexts !== undefined && contexts.length > 1;
    }

    /** Methods for adding edges in the graph **/

    graphCreateReferenceEdge(source: number, destination: number, label: string = ""): void {
        this.graph.addEdge(source, destination, { type: "REF", label });
    }

    graphCreateDependencyEdge(source: number, destination: number, dep: Dependency): void {
        if (source !== destination) {
            this.graph.addEdge(source, destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: dep.name, isPropertyDependency: dep.isProp });
        }
    }

    graphCreateArgumentEdge(source: number, functionArg: number, sourceName?: string): void {
        if (!sourceName) this.graph.addEdge(source, functionArg, { type: "PDG", label: "ARG", objName: sourceName });
        else this.graph.addEdge(source, functionArg, { type: "PDG", label: "ARG", objName: sourceName });
    }

    graphCreateSourceEdge(source: number, destination: number, index: number): void {
        this.graph.addEdge(source, destination, { type: "REF", label: "param", paramIndex: index.toString() })
    }

    graphCreateSinkEdge(source: number, destination: number, type: string): void {
        this.graph.addEdge(source, destination, { type: "SINK", label: "SINK", objName: type })
    }

    graphCreateNewVersionEdge(oldObjId: number, newObjId: number, propName: string): void {
        this.graph.addEdge(oldObjId, newObjId, { type: "PDG", label: "NV", objName: propName });
    }

    graphCreatePropertyEdge(location: number, propertyLocation: number, property: string, deps: Dependency[] = []): void {
        this.graph.addEdge(location, propertyLocation, { type: "PDG", label: "SO", objName: property });

        // if we are writing all possible subObject
        if (property === '*') {
            const objNode = this.graph.nodes.get(location);
            deps.filter(dep => DependencyFactory.isDVar(dep)).forEach(dep => objNode?.addWriteAllSubObjects(dep));
        }
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

    graphCreateCallDependencyEdge(source: number, destination: number, objName: string): void {
        this.graph.addEdge(source, destination, { type: "PDG", label: "DEP", objName });
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
    addParamNode(stmtId: number, paramObj: GraphNode, index: number, funcExpNode: GraphNode, context: number): void {
        let paramName: string;
        if (paramObj.type === "AssignmentPattern") paramName = (paramObj.obj.left as Identifier).name;
        else paramName = (paramObj.obj as Identifier).name;

        // Add location to graph
        const locationName: string = getNextLocationName(paramName, context)
        const nodeObj: GraphNode = this.graph.addNode("PDG_OBJECT", { type: "PDG" });
        nodeObj.identifier = locationName;

        // Add object to store
        this.storeAddLocation(paramName, nodeObj.id, context)

        // connect taint node (only if it is an outer function)
        // const isTainted = !this.isInnerFunction(context)
        // if (isTainted)
        const matchTemporaryFunction: RegExpMatchArray | null | undefined = funcExpNode.functionName?.match("[v]\\d+")
        const isAnonymous: boolean = matchTemporaryFunction !== null && matchTemporaryFunction !== undefined
            ? matchTemporaryFunction.length > 0
            : false;
        const isTainted = !(isAnonymous && this.isInnerFunction(context));
        this.addTaintedNodeEdge(nodeObj.id, stmtId, index, isTainted);
    }

    addTaintedNodeEdge(nodeId: number, stmtId: number, index: number, isTainted: boolean = true): void {
        if (isTainted) this.graph.addEdge(this.graph.taintNode, nodeId, { type: "PDG", label: "TAINT" }); // this.create source edge
        this.graphCreateSourceEdge(stmtId, nodeId, index !== undefined ? index : -1); // sources from argv e.g. do not connect as param edge?
    }

    checkArgumentSource(functionContext: number, trackers: DependencyTracker): Dependency[] {
        const functionNode: GraphNode | undefined = trackers.getFunctionNode(functionContext);
        if (functionNode?.arguments) {
            const functionArgs = functionNode.edges.filter(e => e.type === "REF" && e.label === "param").map(e => e.nodes[1]);
            const deps: Dependency[] = [];
            functionArgs.forEach((fnArg: GraphNode, i: number) => {
                if (fnArg.identifier) {
                    const depName = fnArg.identifier.split('-')[0].split('.')[1]
                    deps.push(DependencyFactory.DVar(depName, fnArg.id, i))
                }
            });
            return deps;
        }
        return [];
    }

    // Connects function arguments without origin to taint source
    addTaintedNodes(): void {
        const functionDeclarationNodes: Array<GraphNode | undefined> | undefined = this.graph.startNodes.get("CFG")
            // ?.filter(cfgNode => !cfgNode?.functionName?.match("[v]\\d+")) // Not generated by the normalization)
            ?.map((cfgNode: GraphNode) => this.graph.nodes.get(cfgNode.functionNodeId))
        const taintedNodes: number[] | undefined = this.graph.nodes.get(this.graph.taintNode)?.edges.map(edge => edge.nodes[1].id)
        functionDeclarationNodes?.forEach((fnExpNode: GraphNode | undefined) => {
            if (!fnExpNode) return;
            const functionParamNodes: GraphNode[] = fnExpNode.edges.filter(edge =>
                edge.type === "REF" && edge.label === "param" && !taintedNodes?.includes(edge.nodes[1].id))
                .map(edge => edge.nodes[1]);
            functionParamNodes.forEach((paramNode: GraphNode, i: number) => {
                // If a param does not have an origin, connect to taint source
                this.addTaintedNodeEdge(paramNode.id, paramNode.functionNodeId, i)
            });
        })
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

    getFunctionNode(context: number): GraphNode | undefined {
        const functionCFGNode = this.graph.nodes.get(context);
        if (functionCFGNode) return this.graph.nodes.get(functionCFGNode.functionNodeId)
    }

    getFunctionNodeFromName(name: string): GraphNode | undefined {
        const cfgNode: GraphNode | undefined = this.graph.startNodes.get("CFG")?.filter((cfgNode: GraphNode) => cfgNode.functionName === name)[0]
        if (cfgNode) {
            return this.graph.nodes.get(cfgNode.functionNodeId)
        }
        return undefined;
    }

    clone(): DependencyTracker {
        const clone = new DependencyTracker(this.graph, this.funcContexts);
        clone.setStore(this.store);
        clone.setContext(this.intraContextStack);
        clone.setRequireChain(this.requireChain);
        clone.setVariableMap(this.variableMap);
        return clone;
    }

    print(): void {
        console.log("Store:", this.store);
        console.log("Func Contexts:", this.funcContexts);
        console.log("Require Chain:", this.requireChain);
        console.log("Variable Map:", this.variableMap);
    }
}

export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode, arg?: number, isProp: boolean=false): Dependency[] {
    switch (node.type) {
        case "Literal":
            return [];

        case "ThisExpression":
        case "Identifier": {
            const objName = node.obj.name;
            const depObjIds: number[] = trackers.getObjectVersions(objName, node.functionContext);
            if (arg) {
                return depObjIds.map((depId: number) => DependencyFactory.DVar(objName, depId, arg, isProp));
            }
            return depObjIds.map((depId: number) => DependencyFactory.DVar(objName, depId, undefined, isProp));
        }

        case "AwaitExpression":
        case "UnaryExpression": {
            const arg = node.obj.argument;
            if (arg.type === "Literal") return [];
            else {
                const objName = arg.name;
                const depObjId = trackers.getObjectVersions(objName, node.functionContext).slice(-1)[0];
                return [DependencyFactory.DVar(objName, depObjId)];
            }
        }

        case "ObjectExpression": {
            const properties = (node.obj.properties);
            if (properties.length !== 0) return []
            // Due to normalization, I think that this case will never happen
            else return getAllASTNodes(node, "properties").map((arg, i) => evalDep(trackers, stmtId, arg, i + 1)).flat(); // D
        }

        case "Property": {
            return evalDep(trackers, stmtId, getASTNode(node, "value"), arg);
        }

        case "LogicalExpression":
        case "BinaryExpression": {
            const leftDep = evalDep(trackers, stmtId, getASTNode(node, "left"));
            const rightDep = evalDep(trackers, stmtId, getASTNode(node, "right"));
            return [leftDep, rightDep].flat();
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");
            const objName = obj.obj.name;

            const locations = trackers.getObjectVersions(objName, obj.functionContext)
            const locationNodes: (GraphNode | undefined)[] = locations
                .map((location: number) => trackers.graphGetNode(location))

            let deps: Dependency[] = [];
            locationNodes.forEach((node: GraphNode | undefined) => {
                if (node && node.writeAllSubObjects.length > 0) {
                    deps.push(...node.writeAllSubObjects)
                }
            })

            // if the member expression is computed and is not a Literal then we have to evaluate the dependencies
            // of the property as it is a variable, because it influences the object otherwise treat it is a Literal
            if (node.obj.computed && prop.type !== "Literal") {
                const objDeps: Dependency[] = evalDep(trackers, stmtId, prop);
                deps = deps.concat(objDeps.filter((item) => !DependencyFactory.includes(deps, item)));
                return deps;
            }

            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the object
            const objIdsProp: number[] = trackers.graphGetObjectVersionsPropertyLocations(objName, obj.functionContext, prop.obj.name);
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
            const argDeps = args.map((arg, i) => {
                let deps: Dependency[] = evalDep(trackers, stmtId, arg, i + 1);
                if (arg.type === "Identifier" && arg.identifier === "arguments") {
                    const argumentDeps: Dependency[] = trackers.checkArgumentSource(node.functionContext, trackers);
                    deps = [...deps, ...argumentDeps]
                }
                return deps;
            }).flat();

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

        case "SequenceExpression": {
            const expressions = getAllASTNodes(node, "expression");
            return expressions.map((arg, i) => evalDep(trackers, stmtId, arg, i + 1)).flat();
        }
        default: {
            console.trace(`Expression ${node.type} didn't match with case values.`);
            return [];
        }
    }
}

export function evalSto(trackers: DependencyTracker, node: GraphNode): number[] {
    switch (node.type) {
        case "Literal":
            return [];

        case "ThisExpression":
        case "Identifier": {
            const objName = node.obj.name;
            return trackers.getObjectLocationsFromStore(objName, node.functionContext)
        }

        case "AwaitExpression":
        case "UnaryExpression": {
            return evalSto(trackers, getASTNode(node, "argument"));
        }

        case "CallExpression": {
            const calleeSto = evalSto(trackers, getASTNode(node, "callee"));
            const argsSto = getAllASTNodes(node, "arguments").map((arg) => evalSto(trackers, arg)).flat();
            return [...calleeSto, ...argsSto];
        }

        case "LogicalExpression":
        case "BinaryExpression": {
            const leftSto = evalSto(trackers, getASTNode(node, "left"));
            const rightSto = evalSto(trackers, getASTNode(node, "right"));
            return [...leftSto, ...rightSto];
        }

        case "MemberExpression": {
            const obj = getASTNode(node, "object");
            const prop = getASTNode(node, "property");

            const objectName = obj.obj.name;
            const locations = trackers.getObjectLocationsFromStore(objectName, node.functionContext)

            const propertyName = (node.obj.computed && prop.type !== "Literal")? '*' : prop.obj.name;
            let propertyLocations: number[] = []
            locations.forEach((location: number) => {
                const propertyLocation: GraphNode | undefined = trackers.graphGetObjectPropertyLocation(location, propertyName)
                if (propertyLocation) {
                    propertyLocations.push(propertyLocation.id)
                }
            })
            return propertyLocations;
        }

        case "TemplateLiteral": {
            return getAllASTNodes(node, "expression").map((arg) => evalSto(trackers, arg)).flat();
        }

        default: {
            console.trace(`Expression ${node.type} didn't match with case values.`);
            return [];
        }
    }
}
