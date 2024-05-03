import { type Graph } from "../../graph/graph";
import { GraphNode } from "../../graph/node";
import { deepCopyStore, getAllASTNodes, getASTNode, getNextLocationName } from "../../../utils/utils";
import * as DependencyFactory from "../dep_factory";
import { type Dependency } from "../dep_factory";
import { type Identifier } from "estree";
import type { GraphEdge } from "../../graph/edge";
import { type PackageOperation } from "../../../utils/summary_reader";
import { getObjectNameFromIdentifier } from "../utils/nodes";

export type Store = Map<string, number[]>;
type FContexts = Map<number, number[]>;
type RequireChain = Map<string, string[]>;

// Each lazy require contains the name of the package and an alias, if it exists
interface LazyRequire { name: string, alias: string | undefined }
type LazyRequires = Map<string, LazyRequire[]>;
type VPMap = Map<string, string>;
// Each operation contains the type of operation and the nodes. E.g. { operation: "nv_*", nodes { left: 1, right: 2 } }
interface Operation { operation: string, node: number }
type AssignmentMap = Map<number, Operation[]>

export class DependencyTracker {
    // This value represents the current state of the graph
    private readonly graph: Graph;
    // This value represents the store
    private store: Store;
    // This value represents the function context stack (fn within fn)
    private readonly funcContexts: FContexts;
    // This value represents the current context stack
    private intraContextStack: number[];
    // This value represents chains of "require" dependencies
    private requireChain: RequireChain;
    // This value represents chains of lazy "require" dependencies
    private lazyRequireChain: LazyRequires;
    // This value represents a map of variable name to package name
    private variableMap: VPMap;
    // This value represents a map of the operations corresponding to each program assignment
    private assignments: AssignmentMap;

     // This value represents a list of nodes that are function calls
     private callNodes: GraphNode[];
    
     // This value represents the module.exports identifier (if it is assinged in the code)
     private moduleExports: string;
 
     // This value represents the module.exports aliases (i.e, variables that point to module.exports)
     private moduleExportsAliases: Set<string>;
 
     // This value represents assignments to module.exports or its aliases
     private moduleExportsAssignments: Map<string, GraphNode>;
 
     // This value represents assignments to exports or its aliases
     private exportsAssignments: Map<string, GraphNode>;
 
     // This value represents the exports aliases (i.e, variables that point to exports)
     private exportsAlias: Set<string>;
 
     // This value represents if exports points to module.exports (in case module.exports is assigned to a different object)
     private exportsPointsToModuleExports: boolean;
 
     // This value represents the declared functions in the code
     private declaredFuncs: Map<string,GraphNode>;

    constructor(graph: Graph, functionContexts: FContexts) {
        this.graph = graph;
        this.store = new Map();
        this.funcContexts = functionContexts;
        this.intraContextStack = new Array<number>();
        this.requireChain = new Map();
        this.lazyRequireChain = new Map();
        this.variableMap = new Map();
        this.assignments = new Map();
        this.callNodes = [];
        this.exportsAlias = new Set();
        this.moduleExportsAliases = new Set();
        this.exportsAssignments = new Map();
        this.moduleExportsAssignments = new Map();
        this.moduleExports = "";
        this.exportsPointsToModuleExports = true;
        this.declaredFuncs = new Map();
    }

    private setContext(newContext: number[]): void {
        const newContextArray = new Array<number>();
        newContext.forEach(c => newContextArray.push(c));
        this.intraContextStack = newContextArray;
    }

    private setRequireChain(newRequireChain: RequireChain): void {
        this.requireChain = new Map(newRequireChain);
    }

    private setLazyRequireChain(newLazyRequireChain: LazyRequires): void {
        this.lazyRequireChain = new Map(newLazyRequireChain);
    }

    private setCallNodes(newCallNodes: GraphNode[]): void {
        this.callNodes = [...newCallNodes];
    }

    private setExportsAssignments(newExportsAssignments: Map<string,GraphNode>): void {
        this.exportsAssignments = new Map(newExportsAssignments);
    }

    private setExportsAlias(newExportsAlias: Set<string>): void {
        this.exportsAlias = new Set(newExportsAlias);
    }

    private setModuleExportsAliases(newModuleExportsAliases: Set<string>): void {
        this.moduleExportsAliases = new Set(newModuleExportsAliases);
    }

    setModuleExportsIdentifier(value: string) {
        this.moduleExports = value; 
        this.exportsPointsToModuleExports = false;
        this.moduleExportsAssignments.clear();
        this.exportsAssignments.clear();
        this.moduleExportsAliases.clear();
        this.exportsAlias.clear();

    }

    private setModuleExportsAssignments(newModuleExportsAssignments: Map<string,GraphNode>): void {
        this.moduleExportsAssignments = new Map(newModuleExportsAssignments);
    }
    
    private setVariableMap(newVariableMap: VPMap): void {
        this.variableMap = new Map(newVariableMap);
    }

    private setAssignmentMap(assignmentMap: AssignmentMap): void {
        this.assignments = new Map(assignmentMap);
    }

    private setDeclaredFuncs(declaredFuncs: Map<string,GraphNode>): void {
        this.declaredFuncs = new Map(declaredFuncs);
    }
    

    get assignmentsMap(): AssignmentMap {
        return this.assignments;
    }

    get requireChainMap(): RequireChain {
        return this.requireChain;
    }

    get lazyRequireChainMap(): LazyRequires {
        return this.lazyRequireChain;
    }

    get storeMap(): Store {
        return this.store;
    }

    get funcContextsMap(): FContexts {
        return this.funcContexts;
    }

    get variablesMap(): VPMap {
        return this.variableMap;
    }

    get callNodesList(): GraphNode[] {
        return this.callNodes;
    }

    get moduleExportsIdentifier(): string {
        return this.moduleExports;
    }
    
    get moduleExportsAliasesSet(): Set<string> {
        return this.moduleExportsAliases;
    }

    get moduleExportsAssignmentsMap(): Map<string,GraphNode> {
        return this.moduleExportsAssignments;
    }

    get exportsAssignmentsMap(): Map<string,GraphNode> {
        return this.exportsAssignments;
    }


    get exportsAliasSet(): Set<string> {
        return this.exportsAlias;
    }

    get declaredFuncsMap(): Map<string,GraphNode> {
        return this.declaredFuncs;
    }

    pushIntraContext(context: number): void {
        this.intraContextStack.push(context);
    }

    popIntraContext(): number | undefined {
        return this.intraContextStack.pop();
    }

    isInnerFunction(funcContextNumber: number): boolean {
        const contexts = this.funcContexts.get(funcContextNumber)
        return contexts !== undefined && contexts.length > 1;
    }

    /*
     Package Require Logic
     */

    addRequireChainEntry(variableName: string, packageName: string): void {
        const pChain = this.requireChain.get(packageName);
        let pChainValue: string[] = [variableName];
        if (pChain) pChainValue = [...pChain, variableName];
        this.requireChain.set(packageName, pChainValue);
        this.addVariableMap(variableName, packageName);
    }

    // Check if a function call is a require (lazy or not) and if so, add to corresponding structures
    checkRequires(functionName: string, callNode: GraphNode, variable: Identifier): void {
        // If function call is a simple require, add require to RequireChainEntry
        if (functionName === "require") {
            const packageName = getAllASTNodes(callNode, "arg")[0];
            const variableName: string = `${callNode.functionContext}.${variable.name}`
            this.addRequireChainEntry(variableName, packageName.obj.value);
        } else if (this.checkIfFunctionIsLazyRequire(functionName, callNode)) { // If function call is a lazy require, add to LazyRequires
            const packageVariableName: string = variable.name;
            this.addLazyRequire(packageVariableName)
        } else this.checkIfLazyDefinition(callNode); // If function call is a definition of a lazy require, update LazyRequire structure
    }

    // Adds lazy require to map (lazy -> methods[])
    addLazyRequire(packageName: string, methodName: string | undefined = undefined, aliasName: string | undefined = undefined): void {
        const lazyRequires: LazyRequire[] | undefined = this.lazyRequireChain.get(packageName);
        // If adding a new method to an existing package
        if (lazyRequires && methodName) {
            this.lazyRequireChain.set(packageName, [...lazyRequires, { name: methodName, alias: aliasName }])
        } else if (!lazyRequires) { // If adding a new package, without method yet (init)
            this.lazyRequireChain.set(packageName, [])
        }
    }

    // Checks if a function call is a lazy require (e.g. lazy = v(require))
    checkIfFunctionIsLazyRequire(functionName: string, callNode: GraphNode): boolean {
        const variableName: string = `${callNode.functionContext}.${functionName}`;
        if (!this.checkVariableMap(variableName)) return false

        if (callNode.obj.callee.type === "Identifier" &&
            callNode.obj.arguments.length) {
            return callNode.obj.arguments
                .filter((element: any) => element.type === "Identifier")
                .some((element: any) => element.name === "require")
        }
        return false
    }

    // keeps track of the called nodes
    addCallNode(callNode: GraphNode): void {
        this.callNodes.push(callNode);
    }

    // Checks if function call is defining a new lazy require (e.g. const v2 = lazy(<name>, <alias>);
    checkIfLazyDefinition(callNode: GraphNode): void {
        if (callNode.obj.callee.type === "Identifier") {
            const requires: LazyRequire[] | undefined = this.lazyRequireChain.get(callNode.obj.callee.name)
            // If function call is a lazy require package
            if (requires && callNode.obj.arguments.length > 1) {
                const packageName: string | undefined = callNode.obj.arguments[0].type === "Literal" ? callNode.obj.arguments[0].value : undefined;
                const packageAlias: string | undefined = callNode.obj.arguments[1].type === "Literal" ? callNode.obj.arguments[1].value : undefined;
                this.addLazyRequire(callNode.obj.callee.name, packageName, packageAlias)
            }
        }
    }

    checkIfLazyCall(calleeName: string, functionName: string): string | undefined {
        const lazyRequires: LazyRequire[] | undefined = this.lazyRequireChain.get(calleeName)
        if (lazyRequires?.length) {
            return lazyRequires.find((require: LazyRequire) => require.name === functionName || require.alias === functionName)?.name
        }
    }

    checkRequireChain(variableName: string | null): string[] {
        return variableName ? this.requireChain.get(variableName) ?? [] : [];
    }

    addVariableMap(variableName: string, functionMap: string): void {
        this.variableMap.set(variableName, functionMap);
    }

    checkVariableMap(variableName: string): string | undefined {
        return this.variableMap.get(variableName);
    }

    addAssignment(assignmentNumber: number, op: Operation): void {
        const ops: Operation[] | undefined = this.assignments.get(assignmentNumber)
        if (ops) {
            this.assignments.set(assignmentNumber, [...ops, op]);
        } else this.assignments.set(assignmentNumber, [op]);
    }

    addExportsAssignment(prop:string,value:GraphNode): void {
        this.exportsPointsToModuleExports && this.exportsAssignments.set(prop,value);
    }

    addModuleExportsAssignment(prop:string,value:GraphNode): void {
        this.moduleExportsAssignments.set(prop,value);
    }

    addExportsAlias(alias: string): void {
        this.exportsAlias.add(alias);
    }

    addModuleExportsAlias(alias: string): void {
        this.moduleExportsAliases.add(alias);
    }

    addDeclaredFunc(funcName: string, node: GraphNode): void {

        // copy the node to avoid changing the original
        const func = new GraphNode(node.id,node.type,node.obj);
        func.identifier = node.identifier;
        func.functionContext = node.functionContext;
        node.edges.forEach(edge => { // remove the control flow edges (not needed if the function is exported)
            edge.type != "CFG" && func.addEdge(edge);
        });
        this.declaredFuncs.set(funcName, func);
    }

    checkAssignment(assignmentNumber: number, operation: string): number | undefined {
        const ops: Operation[] | undefined = this.assignments.get(assignmentNumber)
        if (ops) {
            const sameOperations: Operation[] = ops.filter((op: Operation) => op.operation === operation)
            return sameOperations.length ? sameOperations[0].node : undefined;
        }
        return undefined
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------- STORE OPERATIONS ----------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /*
    * Adds a new location (graph node) to an object (objName) in a context
    * Used in dep_builder: handleMemberExpression and handleSimpleAssignment
    * Used here in: addProp, addParamNode and createNewObject
    */
    storeAddLocation(objName: string, location: number, context: number): void {
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
        } else { // If object does not exist, create new object in store with new location
            this.store.set(objContextName, [location])
        }
    }

    /*
    * Updates an object's old location to a new location
    * Used when adding a new version
    */
    storeUpdateLocation(objName: string, oldLocation: number, newLocations: number[], context: number): void {
        // Check if object exists
        const objContextName: string = `${context}.${objName}`
        const objectExists: boolean = this.store.has(objContextName)

        // If object exists, add update location
        if (objectExists) {
            const objectLocations: number[] = this.store.get(objContextName) ?? []
            let newObjectLocations: number[] = []

            // Search for old location and replace with new location
            objectLocations.forEach((location: number) => {
                if (location === oldLocation) {
                    newObjectLocations.length ? newObjectLocations.push(...newLocations) : newObjectLocations = newLocations
                } else {
                    newObjectLocations.push(location)
                }
            })
            this.store.set(objContextName, [...new Set(newObjectLocations)])
        } else { // If object does not exist, create new object in store with new location
            this.store.set(objContextName, newLocations)
        }
    }

    /*
    * Returns the locations for an object with name "name" in some context
    */
    storeGetObjectLocations(name: string, context: number | undefined = undefined): number[] {
        // 1. Get contexts where object with name "name" exist
        const objectContexts: string[] = this.getPossibleObjectContexts(name, context)
        const validObjectContexts = objectContexts.filter((obj: string) => this.store.has(obj))

        // 2. Choose last context
        const lastObject = validObjectContexts.pop()

        // 3. Get list of object locations
        if (lastObject) {
            return this.store.get(lastObject) ?? []
        }
        return []
    }

    /*
    * Returns list of possible objects with contexts.
    * E.g., for a function context stack of 1,2,3, returns 1.objName, 2.objName, 3.objName
     */
    getPossibleObjectContexts(name: string, context: number | undefined = undefined): string[] {
        if (context) {
            const functionContexts: number[] = this.funcContexts.get(context) ?? []
            return [...functionContexts,context].map((ctx: number) => `${ctx}.${name}`) ?? []
        } else {
            return this.intraContextStack.map((ctx: number) => `${ctx}.${name}`)
        }
    }

    /*
    * Sets the store, using a deep copy
    */
    setStore(newStore: Store): void {
        this.store = deepCopyStore(newStore);
    }

    /*
    * Merges two states of a store
    * Used in IfStatements
     */
    storeMergeStores(storeA: Store, storeB: Store): Store {
        const mergedStore: Store = deepCopyStore(storeA);
        const mergedKeys: string[] = Array.from(mergedStore.keys());

        storeB.forEach((value: number[], key: string) => {
            if (!mergedKeys.includes(key)) {
                // include all pairs in storeB that were not in storeA
                mergedStore.set(key, value);
            } else {
                // include all storage values in storeB that were not in storeA for this key
                const mergedLocs: number[] = mergedStore.get(key) ?? [];
                value.forEach((s: number) => {
                    if (!mergedLocs.includes(s)) {
                        mergedLocs.push(s)
                    }
                });
                mergedStore.set(key, mergedLocs)
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

    /*
    * Adds a new location to the graph -> new node with name objName
    * Used in: addProp, addVersion, createNewObject
     */
    graphAddLocation(objName: string, context: number, _stmtId: number,type:string = "PDG_OBJECT"): GraphNode {
        // Create location
        const locationName: string = getNextLocationName(objName, context)
        const nodeLocation: GraphNode = this.graph.addNode(type, { type: "PDG" });
        nodeLocation.identifier = locationName;

        return nodeLocation;
    }

    /*
    * Get location of property with name property of object location
    * Return undefined when it does not exist
    */
    graphGetObjectPropertyLocation(objectLocation: number, property: string): GraphNode | undefined {
        // 1. Get graph node of object obj
        const graphObjectNode: GraphNode | undefined = this.graph.nodes.get(objectLocation)
        if (!graphObjectNode) { /* TODO: Output error */ }

        // 2. Get property edges
        const propertyEdges: GraphEdge[] | undefined = graphObjectNode?.edges
            .filter((edge: GraphEdge) => edge.type === "PDG" && edge.label === "SO" && edge.objName === property)

        if (propertyEdges && propertyEdges.length > 1) { /* TODO: Output error */ } else if (propertyEdges) {
            return propertyEdges.pop()?.nodes[1]
        } else {
            return undefined
        }
    }

    /*
    * Gets the property propName location for all locations of object objName
    * Used in evalDep (MemberExpression)
     */
    graphGetObjectVersionsPropertyLocations(objName: string, context: number, propName: string): number[] {
        const locations: number[] = this.getObjectVersions(objName, context)

        const propertyLocations: number[] = []
        locations.forEach((location: number) => {
            const propertyLocation: number | undefined = this.graphGetObjectPropertyLocation(location, propName)?.id
            if (propertyLocation) {
                propertyLocations.push((propertyLocation))
            }
        })
        return propertyLocations;
    }

    /*
    * Gets the graph node of a location
     */
    graphGetNode(location: number): GraphNode | undefined {
        return this.graph.nodes.get(location)
    }
    // ------------------------------------------------------------------------------------------------------------ //
    // ---------------------------------------- AUXILIARY OPERATIONS ----------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /* Adds the new property to the object locations */
    addProp(locations: number[], objectName: string, property: string, context: number, stmtId: number, deps: Dependency[] = []): number[] {
        const propertyLocations: number[] = []
        // For each location
        locations.forEach((location: number) => {
            // 1. Check if property exists
            let propertyLocation = this.graphGetObjectPropertyLocation(location, property)

            // 2. Check if property was already created for this assignment (loop case)
            const propertyAssigned: number | undefined = this.checkAssignment(stmtId, `p_${property}`)
            if (propertyAssigned && !propertyLocation) {
                // 2.1. If property edge does not exist, create it
                this.graphCreatePropertyEdge(location, propertyAssigned, property);
                propertyLocation = this.graphGetNode(propertyAssigned)
            }

            // 3. If property does not exist, need to create the object property
            if (!propertyLocation) {
                // 2.1 Add property location to graph
                propertyLocation = this.graphAddLocation(`${objectName}.${property}`, context, stmtId)
                this.graphCreatePropertyEdge(location, propertyLocation.id, property);
                this.addAssignment(stmtId, { operation: `p_${property}`, node: propertyLocation.id })

                // 2.2 Add property location to store
                // this.storeAddLocation(objectName, location, context)

                // Add dependencies of property
                deps.forEach(dep => {
                    propertyLocation?.id && this.graphCreateDependencyEdge(dep.source, propertyLocation.id, dep);
                });
            }
            // Add property location to array
            propertyLocations.push(propertyLocation.id)
        })
        return propertyLocations;
    }

    /*
    * Creates a new object: creates location in graph and adds to store
     */
    createNewObject(stmtId: number, functionContext: number, variable: Identifier,type:string = "PDG_OBJECT"): number {
        // Check if object was already created (because of loops)
        let newObjectAssigned: number | undefined = this.checkAssignment(stmtId, `obj_${variable.name}`)
        if (!newObjectAssigned) {
            // Create location
            const location = this.graphAddLocation(variable.name, functionContext, stmtId,type)
            newObjectAssigned = location.id
            // Add to store
            this.storeAddLocation(variable.name, location.id, functionContext)
            // Create reference edge
            this.graphCreateReferenceEdge(stmtId, location.id, variable.name)
            this.addAssignment(stmtId, { operation: `obj_${variable.name}`, node: newObjectAssigned })
        }
        return newObjectAssigned;
    }

    /*
    * Adds a new version to object objName via property propName
    */
    addVersion(stmtId: number, objName: string, context: number, propName: string, deps: Dependency[]): void {
        const objectLocations: number[] = this.storeGetObjectLocations(objName, context)

        // 1. Create new version locations
        // Note: check if it was already created in the same assignment (loops)
        const newLocations: number[] = []
        objectLocations.forEach((location: number) => {
            const oldLocation: GraphNode | undefined = this.graphGetNode(location);
            // Check if node already has a new version edge for this assignment
            const newVersionAssigned: number | undefined = this.checkAssignment(stmtId, `nv_${propName}`)
            if (newVersionAssigned) {
                const newVersionEdges: GraphEdge[] | undefined = oldLocation?.edges.filter((edge: GraphEdge) => edge.type === "PDG" && edge.label === "NV" && edge.objName === propName)
                if ((newVersionEdges?.length && newVersionEdges[0].nodes[1].id !== newVersionAssigned) || !newVersionEdges || !newVersionEdges?.length) {
                    this.graphCreateNewVersionEdge(location, newVersionAssigned, propName);
                }
                newLocations.push(newVersionAssigned)
            } else {
                const newLocation: GraphNode = this.graphAddLocation(objName, context, stmtId);
                this.graphCreateNewVersionEdge(location, newLocation.id, propName);
                this.addAssignment(stmtId, { operation: `nv_${propName}`, node: newLocation.id })
                newLocations.push(newLocation.id)
                if (propName === "*") {
                    newLocation.addPropertyDependencies(deps)
                } else if (oldLocation && oldLocation.propertyDependencies.length > 0) {
                    newLocation.addPropertyDependencies(oldLocation.propertyDependencies)
                }
            }
        })

        // 2. Update store for locations
        newLocations.forEach((location: number, i: number) => {
            this.storeUpdateLocation(objName, objectLocations[i], [location], context);
        })

        // 3. Add property (locations and store)
        const propertyLocations: number[] = this.addProp(newLocations, objName, propName, context, stmtId)

        // Process dependencies of the left and right side of the assignment
        deps.forEach(dep => {
            if (!dep.isProp) {
                propertyLocations.forEach((id: number) => {
                    this.graphCreateDependencyEdge(dep.source, id, dep);
                });
            } else {
                newLocations.forEach((id: number) => {
                    this.graphCreateDependencyEdge(dep.source, id, dep);
                });
            }
        })

        // Add reference edges
        propertyLocations.forEach((id: number) => {
            this.graphCreateReferenceEdge(stmtId, id)
        })
    }

    /*
    * Gets new version of an object objName locations
    * Note: does not return the chain of new versions
    */
    getObjectVersions(objName: string, context: number): number[] {
        const locations: number[] = this.storeGetObjectLocations(objName, context)

        const objectVersions: number[] = [...locations]
        locations.forEach((location: number) => {
            const locationNode: GraphNode | undefined = this.graph.nodes.get(location)
            if (locationNode) {
                const newVersionLocations: number[] = locationNode.edges
                    .filter((edge: GraphEdge) => edge.type === "PDG" && edge.label === "NV")
                    .map((edge: GraphEdge) => edge.nodes[1].id)
                objectVersions.push(...newVersionLocations)
            }
        })
        return objectVersions;
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    /** Methods for adding edges in the graph **/
    graphCreateReferenceEdge(source: number, destination: number, label: string = ""): void {
        const refEdges: number[] = this.graphGetNode(source)?.edges
            .filter((edge: GraphEdge) => edge.type === "REF")
            .map((edge: GraphEdge) => edge.nodes[1].id) ?? []
        if (!refEdges.includes(destination)) {
            if (label === "this") {
                this.graph.addEdge(source, destination, { type: "REF", label: "param", paramIndex: "this" })
            } else {
                this.graph.addEdge(source, destination, { type: "REF", label: "obj" });
            }
        }
    }

    graphCreateDependencyEdge(source: number, destination: number, dep: Dependency): void {
        if (source !== destination) {
            const sourceEdges: number[] = this.graphGetNode(source)?.edges.map((edge: GraphEdge) => edge.nodes[1].id) ?? []
            if (!sourceEdges.includes(destination)) { this.graph.addEdge(source, destination, { type: "PDG", label: DependencyFactory.translate(dep.type), objName: dep.name, isPropertyDependency: dep.isProp }); }
        }
    }

    graphCreateCallStatementDependencyEdges(_stmtId: number, newObjId: number, deps: Dependency[]): void {
        // const varDeps = deps.filter(dep => DependencyFactory.isDVar(dep));

        // // calleeDeps.forEach(dep => { this.graphCreateReferenceEdge(stmtId, dep.source); });
        // varDeps.forEach(dep => { this.graphCreateDependencyEdge(dep.source, newObjId, dep); });
    }

    graphCreateCallDependencyEdge(source: number, destination: number, objName: string): void {
        // if (source !== destination) {
        //     const sourceEdges: number[] = this.graphGetNode(source)?.edges.map((edge: GraphEdge) => edge.nodes[1].id) ?? []
        //     if (!sourceEdges.includes(destination)) { this.graph.addEdge(source, destination, { type: "PDG", label: "DEP", objName }); }
        // }
    }

    graphCreateArgumentEdge(source: number, functionArg: number, label:string,sourceName?: string): void {
        if (source !== functionArg) {
            const sourceEdges: number[] = this.graphGetNode(source)?.edges.map((edge: GraphEdge) => edge.nodes[1].id) ?? []
            if (!sourceEdges.includes(functionArg)) {
                if (!sourceName) {
                    this.graph.addEdge(source, functionArg, {
                        type: "PDG",
                        label: label,
                        objName: sourceName
                    });
                } else this.graph.addEdge(source, functionArg, { type: "PDG", label: label, objName: sourceName });
            }
        }
    }

    graphCreateSourceEdge(source: number, destination: number, index: number): void {
        this.graph.addEdge(source, destination, { type: "REF", label: "param", paramIndex: index.toString() })
    }

    graphCreateSinkEdge(source: number, destination: number, type: string): void {
        this.graph.addEdge(source, destination, { type: "SINK", label: "SINK", objName: type })
    }

    graphCreateReturnEdge(source: number, destination: number): void {
        this.graph.addEdge(source, destination, { type: "REF", label: "return" })
    }

    graphCreatePDGReturnEdge(source: number, destination: number): void {
        this.graph.addEdge(source, destination, { type: "PDG", label: "RET" })
    }

    graphCreateCallEdge(source: number, destination: number): void {
        this.graph.addEdge(source, destination, { type: "CG", label: "CG"})
    }

    graphCreateNewVersionEdge(oldObjId: number, newObjId: number, propName: string): void {
        const sourceEdges: number[] = this.graphGetNode(oldObjId)?.edges.map((edge: GraphEdge) => edge.nodes[1].id) ?? []
        if (!sourceEdges.includes(newObjId) && oldObjId !== newObjId) { this.graph.addEdge(oldObjId, newObjId, { type: "PDG", label: "NV", objName: propName }); }
    }

    graphCreatePropertyEdge(location: number, propertyLocation: number, property: string, _deps: Dependency[] = []): void {
        this.graph.addEdge(location, propertyLocation, { type: "PDG", label: "SO", objName: property });
    }

    translateOperations(operations: PackageOperation[], callNode: GraphNode, functionContext: number, stmtId: number): void {
        const callArgs: GraphNode[] = getAllASTNodes(callNode, "arg");

        operations.forEach((op: PackageOperation) => {
            switch (op.type) {
                case "sub_object": {
                    // Create property of object
                    const objectName: string = callArgs[0].identifier ?? ""
                    const objectLocations: number[] = this.getObjectVersions(objectName, functionContext)
                    const propertyLocations: number[] = this.addProp(objectLocations, objectName, '*', functionContext, stmtId)

                    // Map summary dependencies
                    const functionLocation = this.getFunctionNodeFromName(callArgs[1].identifier ?? "")
                    if (!functionLocation) break; // This should not happen
                    const calledArgNodes: GraphNode[] = functionLocation.edges.filter((edge: GraphEdge) => edge.type === "REF" && edge.label === "param").map((edge: GraphEdge) => edge.nodes[1])
                    if (op.objs.some((obj: number) => obj >= calledArgNodes.length)) break; // This should not happen
                    propertyLocations.forEach((location: number) => {
                        // Create argument edge between new property and function argument
                        this.graphCreateArgumentEdge(location, calledArgNodes[op.objs[0]].id)
                        // Create dependency edge between new property and function argument
                        const keyDependency: string | undefined = getObjectNameFromIdentifier(calledArgNodes[op.objs[1]].identifier)
                        if (keyDependency) { this.graphCreateCallDependencyEdge(calledArgNodes[op.objs[1]].id, location, keyDependency) }
                    })
                }
            }
        })
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

        // Connect taint node
        const matchTemporaryFunction: RegExpMatchArray | null | undefined = funcExpNode.functionName?.match("[v]\\d+")
        const isAnonymous: boolean = matchTemporaryFunction !== null && matchTemporaryFunction !== undefined
            ? matchTemporaryFunction.length > 0
            : false;
        const isTainted = !(isAnonymous && this.isInnerFunction(context));
        this.addTaintedNodeEdge(nodeObj.id, stmtId, index,isTainted);
    }

    addTaintedNodeEdge(nodeId: number, stmtId: number, index: number, isTainted: boolean = true,createSourceEdge:boolean = true): void {
        const sourceEdges: number[] = this.graphGetNode(this.graph.taintNode)?.edges.map((edge: GraphEdge) => edge.nodes[1].id) ?? []
        if (!sourceEdges.includes(nodeId)) {
            if (isTainted) this.graph.addEdge(this.graph.taintNode, nodeId, { type: "PDG", label: "TAINT" }); // this.create source edge
            createSourceEdge && this.graphCreateSourceEdge(stmtId, nodeId, index !== undefined ? index : -1); // sources from argv e.g. do not connect as param edge?
        }
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
                this.addTaintedNodeEdge(paramNode.id, paramNode.functionNodeId, i,fnExpNode.exported,false);
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

    getFunctionObject(functionId: number): GraphNode | undefined {
        const functionNode = this.graph.nodes.get(functionId);
        if (functionNode) {
            const edges: GraphEdge[] = functionNode.edges.filter((edge: GraphEdge) => edge.type === "REF" && edge.label === "obj")
            if (edges.length > 0) return edges[0].nodes[1]
        }
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
        clone.setLazyRequireChain(this.lazyRequireChain);
        clone.setVariableMap(this.variableMap);
        clone.setAssignmentMap(this.assignments);
        clone.setCallNodes(this.callNodes);
        clone.setModuleExportsIdentifier(this.moduleExportsIdentifier);
        clone.setModuleExportsAssignments(this.moduleExportsAssignmentsMap);
        clone.setExportsAssignments(this.exportsAssignmentsMap);
        clone.setExportsAlias(this.exportsAlias);
        clone.setModuleExportsAliases(this.moduleExportsAliases);
        clone.setDeclaredFuncs(this.declaredFuncs);
        clone.exportsPointsToModuleExports = this.exportsPointsToModuleExports;
        return clone;
    }

    print(): void {
        console.log("Store:", this.store);
        console.log("Func Contexts:", this.funcContexts);
        console.log("Require Chain:", this.requireChain);
        console.log("Lazy Requires", this.lazyRequireChain)
        console.log("Variable Map:", this.variableMap);
    }
}

export function evalDep(trackers: DependencyTracker, stmtId: number, node: GraphNode, arg?: number, isProp: boolean = false): Dependency[] {
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

            let deps: Dependency[] = [];
            // if the member expression is computed and is not a Literal then we have to evaluate the dependencies
            // of the property as it is a variable, because it influences the object otherwise treat it is a Literal
            if (node.obj.computed && prop.type !== "Literal") {
                const objDeps: Dependency[] = evalDep(trackers, stmtId, prop, undefined, true);
                deps = deps.concat(objDeps.filter((item) => !DependencyFactory.includes(deps, item)));
                return deps;
            }

            // if the prop is a Literal or the member expression is not
            // computed then we just evaluate the dependencies for the object
            const objIdsProp: number[] = trackers.graphGetObjectVersionsPropertyLocations(objName, obj.functionContext, prop.obj.name);
            deps = objIdsProp.map(objId => DependencyFactory.DObject(prop.obj.name, stmtId, objId))
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
            return trackers.storeGetObjectLocations(objName, node.functionContext)
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
            const locations = trackers.storeGetObjectLocations(objectName, node.functionContext)

            const propertyName = (node.obj.computed && prop.type !== "Literal") ? '*' : prop.obj.name;
            const propertyLocations: number[] = []
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
