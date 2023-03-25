import { type GraphEdge } from "../graph/edge";
import { type Graph } from "../graph/graph";
import { type GraphNode } from "../graph/node";
import { clone, createThisExpression, getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto, type Store } from "./dependency_trackers";
import { StorageFactory, type StorageObject, type StorageValue } from "./sto_factory";
import { type Identifier } from "estree";
import { DependencyFactory, type Dependency } from "./dep_factory";
import { type Config } from "../../utils/config_reader";
import { type SummaryDependency } from "../../utils/summary_reader";

export interface PDGReturn {
    graph: Graph
    trackers: DependencyTracker
}

/** Object creation functions **/
function createNewObjectNodeVariable(stmtId: number, functionContext: number, variable: Identifier, trackers: DependencyTracker): number {
    // create node for variable
    const variableName = trackers.getContextNameList(variable.name, functionContext).slice(-1)[0];
    const simpleVariableName = variable.name;

    // Add to heap
    const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(simpleVariableName, variableName);
    // Store the identifier of the new object
    trackers.addToStore(variableName, StorageFactory.StoObject(pdgObjNameContext));
    // Create new object in graph
    return trackers.graphCreateNewObject(stmtId, simpleVariableName, pdgObjName, pdgObjNameContext);
}

// TODO - I think these functions can be merged
function createSubObject(stmtId: number, objNameContext: string, propName: string, deps: Dependency[], trackers: DependencyTracker): number | undefined {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = trackers.getHeapValue(lastObjLocation);
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {
            const objNameProperty = `${objNameContext}.${propName}`;
            const objNameContextProperty = `${lastObjLocation}.${propName}`;

            // add to heap
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty, {});
            locationHeapValue[propName] = StorageFactory.StoObject(pdgObjNameContext);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, pdgObjName, pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(oldObjVersionId, subObjectId, propName, deps);
            return subObjectId;
        }
    }
}

function createNewObjectVersion(stmtId: number, objName: string, objNameContext: string, propName: string, deps: Dependency[], trackers: DependencyTracker): void {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = clone(trackers.getHeapValue(lastObjLocation));
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {
            // Update heap, store and create new object (for the new version) in graph
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);
            trackers.addToStore(objNameContext, StorageFactory.StoObject(pdgObjNameContext));
            const newObjVersionId = trackers.graphCreateNewObject(stmtId, objName, pdgObjName, pdgObjNameContext);

            // Create edge between old version and new version
            trackers.graphCreateNewVersionEdge(oldObjVersionId, newObjVersionId, propName);

            // Update heap, store and create new object (for the sub-object of the new version) in graph
            const objNameProperty = `${pdgObjName}.${propName}`;
            const objNameContextProperty = `${pdgObjNameContext}.${propName}`;
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            locationHeapValue[propName] = StorageFactory.StoObject(propNamesInHeap.pdgObjNameContext);
            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);

            // Create edge between new version and new sub-object
            trackers.graphCreateSubObjectEdge(newObjVersionId, subObjectId, propName);

            // Process dependencies of the right side of the assignment
            deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep) });
        }
    }
}

function createNewObjectVersionWithStorage(stmtId: number, objName: string, objNameContext: string, propName: string, rightStorageValue: StorageValue, deps: Dependency[], trackers: DependencyTracker): void {
    // get last location of object (most recent version)
    const lastObjLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastObjLocation) {
        const locationHeapValue = clone(trackers.getHeapValue(lastObjLocation));
        const oldObjVersionId = trackers.getObjectId(lastObjLocation);

        if (locationHeapValue && oldObjVersionId) {
            // Update heap, store and create new object (for the new version) in graph
            const { pdgObjName, pdgObjNameContext } = trackers.addNewObjectToHeap(objName, objNameContext, locationHeapValue);
            trackers.addInStoreForAll(lastObjLocation, StorageFactory.StoObject(pdgObjNameContext));
            const newObjVersionId = trackers.graphCreateNewObject(stmtId, objName, pdgObjName, pdgObjNameContext);

            // Create edge between old version and new version
            trackers.graphCreateNewVersionEdge(oldObjVersionId, newObjVersionId, propName);

            // Update heap, store and create new object (for the sub-object of the new version) in graph
            const objNameProperty = `${pdgObjName}.${propName}`;
            const objNameContextProperty = `${pdgObjNameContext}.${propName}`;
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            locationHeapValue[propName] = rightStorageValue;
            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);

            // If old version have a sub object with a hanging ref, update the ref
            const oldSubjObjects = trackers.getPropStorage(objNameContext, propName)
            const previousSubObject = oldSubjObjects.slice(-2)[0]
            if (previousSubObject && "location" in previousSubObject) {
                trackers.addInStoreForAll(previousSubObject.location, StorageFactory.StoObject(propNamesInHeap.pdgObjNameContext));
            }

            // Create edge between new version and new sub-object
            trackers.graphCreateSubObjectEdge(newObjVersionId, subObjectId, propName, deps);

            // Process dependencies of the right side of the assignment
            deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep); });
        }
    }
}

/** **/
function createArrayElement(stmtId: number, objName: string, objNameContext: string, elementIndex: number, propValue: StorageValue, deps: Dependency[], trackers: DependencyTracker): void {
    const lastLocation = trackers.getLastObjectLocation(objNameContext);

    if (lastLocation) {
        const locationHeapValue = trackers.getHeapValue(lastLocation);
        const objVersionId = trackers.getObjectId(lastLocation);

        if (locationHeapValue && objVersionId) {
            const propName = elementIndex.toString();

            const objNameProperty = `${objNameContext}.${propName}`;
            const objNameContextProperty = `${lastLocation}.${propName}`;
            const propNamesInHeap = trackers.addNewObjectToHeap(objNameProperty, objNameContextProperty);
            locationHeapValue[propName] = StorageFactory.StoObject(propNamesInHeap.pdgObjNameContext);

            const subObjectId = trackers.graphCreateNewObject(stmtId, propName, propNamesInHeap.pdgObjName, propNamesInHeap.pdgObjNameContext);
            trackers.graphCreateSubObjectEdge(objVersionId, subObjectId, propName);

            deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, subObjectId, dep); });
            trackers.graphCreateReferenceEdge(stmtId, subObjectId);
        }
    }
}

function handleArrayExpressionElement(stmtId: number, functionContext: number, variable: Identifier, elemNode: GraphNode, elementIndex: number, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, functionContext).slice(-1)[0];

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, elemNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, elemNode)[0];

    createArrayElement(stmtId, variableName, variableNameContext, elementIndex, storageValue, deps, trackers);

    return trackers;
}

function handleArrayExpression(stmtId: number, functionContext: number, variable: Identifier, arrExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // Check if object/array already exists
    let objId;
    const arrayObj = trackers.getObjectVersionNodes(variable.name, functionContext).slice(-1)[0];
    if (!arrayObj) {
        objId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);
    } else {
        objId = arrayObj.id;
    }
    // create new empty object node
    trackers.graphCreateReferenceEdge(stmtId, objId);

    const arrElementEdges = getAllASTEdges(arrExpNode, "element");
    arrElementEdges.forEach((edge) => {
        const elementIndex = edge.elementIndex;
        const element = edge.nodes[1];
        trackers = handleArrayExpressionElement(stmtId, functionContext, variable, element, elementIndex, trackers);
    });

    return trackers;
}

/* This method translates the dependencies of the summaries into the corresponding object
* 0 is the called object
* -1 is the return object
* >1 are the arguments of the functions */
function translateDependency(depNumber: number, deps: Dependency[], obj: GraphNode, objName: string, ret: number): [number, string | null] {
    switch (depNumber) {
        case -1:
            return [ret, ""]
        case 0:
            return [obj.id, objName]
        default:
            // Here, is only returning the first found argument
            // TODO: support all arguments (e.g. push(x,y,z)
            const dep = deps.find(d => d.arg === depNumber)
            return [dep?.source ?? -1, dep?.name ?? ""]
    }
}

function handleCallStatement(stmtId: number, functionContext: number, variable: Identifier, callNode: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    // Get function name
    const callASTNode = getASTNode(callNode, "callee");
    let callName: string, calleeName: string, callee: Identifier;
    if (callASTNode.obj.type === "MemberExpression") {
        callName = callASTNode.obj.property.name;
        callee = callASTNode.obj.object;
        calleeName = callee.name; // Get callee object name (e.g. arr)
    } else {
        callName = callASTNode.obj.name;
        callee = callASTNode.obj;
        calleeName = callee.name;
    }

    const functionNameContext = trackers.getContextNameList(callName, functionContext).slice(-1)[0];

    if (callName === "require") {
        const packageName = getAllASTNodes(callNode, "arg")[0];
        const variableName = trackers.getContextNameList(variable.name, functionContext).slice(-1)[0];
        trackers.addRequireChainEntry(variableName, packageName.obj.value);
    }

    const calleeObjectDeps = [];
    if (callNode.obj.callee.type === "MemberExpression") {
        const calleeDeps = evalDep(trackers, stmtId, getASTNode(callASTNode, "object"));
        calleeObjectDeps.push(...calleeDeps);
    }

    const deps = evalDep(trackers, stmtId, callNode);

    // create new object
    const newObjId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    // process dependencies of call
    trackers.graphCreateCallStatementDependencyEdges(stmtId, newObjId, deps);

    // Create sinks when promisify(exec) e.g.
    const varDeps = deps.filter(dep => DependencyFactory.isDVar(dep));
    varDeps.forEach(dep => {
        const variableMap = trackers.checkVariableMap(`${callNode.functionContext}.${dep.name}`)
        if (variableMap) trackers.addVariableMap(`${callNode.functionContext}.${variable.name}`, variableMap);
    })

    // Process dependencies between the subjects of the call
    // E.g. dependencies of object (arr) being called upon (e.g. arr.push(x))
    // TODO: Should this create a new version?
    if (callNode.obj.callee.type === "MemberExpression") {
        let latestCallObj = trackers.getObjectVersionNodes(calleeName, callNode.functionContext).slice(-1)[0];
        // Get summary for the function
        const functionSummary: SummaryDependency[] | undefined = config.summaries.get(callName);
        if (functionSummary?.length) {
            // For each summary item (obj, dependencies)
            functionSummary.forEach((summaryItem) => {
                // Get object (destination) information
                const destination = translateDependency(summaryItem.obj, deps, latestCallObj, calleeName, newObjId)
                // For each dependency, add the corresponding edge
                summaryItem.deps.forEach(d => {
                    const source = translateDependency(d, deps, latestCallObj, calleeName, newObjId)
                    trackers.graphCreateCallDependencyEdge(source[0], destination[0], source[1])
                })
            })
        // If there is no function summary available, assume all dependencies
        } else if (functionSummary && !functionSummary.length) {
            // If called object doesn't exist (e.g. it was the return of a function)
            if (!latestCallObj) {
                const newObjId = createNewObjectNodeVariable(stmtId, functionContext, callee, trackers);
                latestCallObj = trackers.getObjectVersionNodes(calleeName, callNode.functionContext).slice(-1)[0];
                trackers.graphCreateReferenceEdge(stmtId, newObjId);
            }
            // Dependency callee -> ret
            if (latestCallObj.id !== newObjId) trackers.graphCreateCallDependencyEdge(latestCallObj.id, newObjId, calleeName)
            // Call params -> callee
            // get callee dependencies for arr.push()
            if (!deps.filter(d => DependencyFactory.isDCallee(d)).length) {
                deps.push(...calleeObjectDeps);
            }
            deps.forEach(d => {
                if (d.source !== latestCallObj.id) trackers.graphCreateCallDependencyEdge(d.source, latestCallObj.id, d.name)
            })
        }
    }

    const contextFunctionNames = trackers.getContextNameList(calleeName, functionContext);
    const matchedFunctionName = contextFunctionNames
        .sort((a, b) => parseInt(a) - parseInt(b))
        .find(fc => trackers.checkVariableMap(fc))
    const functionNameMap = matchedFunctionName ? trackers.checkVariableMap(matchedFunctionName) : undefined;

    let sinkName = callName;
    // check sink name
    let functionSinks;
    if (functionNameMap) {
        sinkName = functionNameMap;
    }
    functionSinks = config.functions.filter((s) => s.sink === sinkName);

    if (functionSinks.length > 0) {
        const sink = functionSinks.slice(-1)[0];

        // function being called is a sink
        // we have to check if the sink node already exists for this function
        const checkSink = trackers.graphCheckSinkNode(sinkName);
        let sinkNode: number;

        if (!checkSink) {
            // create sink node if it does not exist
            sinkNode = trackers.graphAddSinkNode(sinkName).id;
        } else {
            sinkNode = checkSink;
        }
        trackers.graphCreateSinkEdge(stmtId, sinkNode, sinkName)

        // connect appropriate arguments to sink node
        // I am only connecting potentially vulnerable arguments
        // according to config
        deps.forEach(dep => {
            if (DependencyFactory.isDVar(dep) && dep.arg && sink.args.includes(dep.arg)) {
                trackers.graphConnectToSinkNode(dep.source, dep.name, sinkNode);
            }
        });
    }

    let sinkPackageName: string;
    if (functionNameMap) {
        if (callASTNode.obj.type !== "MemberExpression") sinkName = functionNameMap.split('.')[1];
        else sinkName = callName;
        sinkPackageName = functionNameMap.split('.')[0];
    }
    const packageSinks = config.packages.filter((s) => s.sink === sinkName);

    if (packageSinks.length > 0) {
        const sink = packageSinks.slice(-1)[0];

        // function being called is a sink
        // we have to check if the sink node already exists for this function
        const checkSink = trackers.graphCheckSinkNode(sinkName);
        let sinkNode: number;

        if (!checkSink) {
            // create sink node if it does not exist
            sinkNode = trackers.graphAddSinkNode(sinkName).id;
        } else {
            sinkNode = checkSink;
        }
        trackers.graphCreateSinkEdge(stmtId, sinkNode, sinkName)

        // connect appropriate arguments to sink node
        // I am only connecting potentially vulnerable arguments
        // according to config
        const sinkArgs = sink.packages.find(p => p.package === sinkPackageName)?.args;
        deps.forEach(dep => {
            if (DependencyFactory.isDVar(dep) && dep.arg && sinkArgs?.includes(dep.arg)) {
                trackers.graphConnectToSinkNode(dep.source, dep.name, sinkNode);
            }
        });
    }

    return trackers;
}

function handleObjectExpression(stmtId: number, functionContext: number, variable: Identifier, objExp: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // create new empty object node
    const newObjId = createNewObjectNodeVariable(stmtId, functionContext, variable, trackers);

    // create reference edge
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    return trackers;
}

function handleMemberExpression(stmtId: number, stmt: GraphNode, variable: Identifier, memExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;
    const variableNameContext = trackers.getContextNameList(variableName, stmt.functionContext).slice(-1)[0];

    // get child nodes for the member expression
    const obj = getASTNode(memExpNode, "object");
    const prop = getASTNode(memExpNode, "property");

    const objNameContextList = trackers.getContextNameList(obj.obj.name, stmt.functionContext);
    let objNameContext;
    let mapName;
    while (!mapName && objNameContextList.length > 0) {
        objNameContext = objNameContextList.pop();
        if (objNameContext) mapName = trackers.checkVariableMap(objNameContext);
    }
    if (mapName && prop.type === "Identifier") {
        trackers.addVariableMap(variableNameContext, `${mapName}.${prop.obj.name}`);
    }

    // evaluate dependency of expression
    let deps = evalDep(trackers, stmtId, memExpNode);
    let subObjId = deps
        .filter(d => DependencyFactory.isDObject(d))
        .map(d => d.source).slice(-1)[0];

    // if there are no object dependencies then we have to create the objects corresponding to the properties in the
    // memExpNode and re-run evalDep
    if (deps.filter(d => DependencyFactory.isDObject(d)).length === 0) {
        const objName = obj.obj.name;
        const objNameContextList = trackers.getContextNameList(objName, stmt.functionContext);
        const validObj = trackers.getValidObject(objNameContextList);
        const objNameContext = validObj ? validObj.name : objNameContextList.slice(-1)[0];
        let propName = prop.obj.name;

        // if the member expression is computed and is not a Literal
        if (memExpNode.obj.computed && prop.type !== "Literal") {
            // change propName to be '*' since the property is dynamic
            propName = '*';
        }

        // Check if object exists
        const subObj = trackers.getObjectVersionsWithProp(objName, obj.functionContext, propName);

        if (!subObj.length) {
            const newObjId = createSubObject(stmtId, objNameContext, propName, deps, trackers);
            if (newObjId) subObjId = newObjId;
        }
        deps = evalDep(trackers, stmtId, memExpNode);
    }

    // check if this expression is already in storage
    // we just check the last value in storage because
    // it is the most recent
    const storageValueArray = evalSto(trackers, memExpNode);

    if (storageValueArray.length > 0) {
        const storageValue = storageValueArray.slice(-1)[0];
        if (!StorageFactory.isStorageObject(storageValue)) {
            // // if the expression is not an object then
            // // create a new one, otherwise we need a new object
            // const newObjReturn = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
            // newTrackers = newObjReturn.newTrackers;
        } else {
            // if the expression is a known object
            // then we just reference it
            const storeObj = storageValue as StorageObject;

            // store the identifier of the location
            trackers.addToStore(variableNameContext, storeObj);
        }
    }

    trackers.graphCreateMemberExpressionDependencies(stmtId, subObjId, deps);

    return trackers;
}

function handleFunctionDeclaration(stmtId: number, stmt: GraphNode, funcNode: GraphNode, funcIdentifier: Identifier, funcExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    trackers = trackers.addFunctionContext(funcNode.id);

    // add context so that params are in the context of funcNode execution
    trackers = pushContext(trackers, funcNode.id);

    // Create the ThisObject for all function
    const newObjId = createNewObjectNodeVariable(stmtId, funcNode.functionContext, createThisExpression(), trackers);
    trackers.graphCreateReferenceEdge(stmtId, newObjId);

    // Check if outer scope contains this object
    // If not, create new this object
    // const funcContext = trackers.getFuncContext(funcNode.id);
    // if (funcContext !== null && funcContext?.length === 1) {
    //     const newObjId = createNewObjectNodeVariable(stmtId, funcNode.functionContext, createThisExpression(), trackers);
    //     trackers.graphCreateReferenceEdge(stmtId, newObjId);
    // } else {
    //     // If so, reference to the other this
    //     const x = trackers.getStorage(`${funcContext.slice(-1)}.this`);
    //     if (x?.length > 0) trackers.addToRefs(x?.slice(-1)[0].location,`${funcNode.functionContext}.this` )
    // }

    // track all parameters of this function
    const unpatternedParams = getAllASTNodes(funcExpNode, "param");
    // in case a parameter is an object expression
    const params: GraphNode[] = []
    unpatternedParams.forEach((p, i) => {
        if (p.type === "ObjectPattern") {
            const objParams = getAllASTNodes(p, "property").map(prop => getASTNode(prop, "value"));
            params.push(...objParams)
        } else params.push(p)
    })

    params.forEach((p, i) => {
        const paramName = (p.obj as Identifier).name;
        const latestParamContextName = trackers.getContextNameList(paramName, funcNode.functionContext).slice(-1)[0];

        // create param node and connect to taint source
        trackers.addParamNode(stmtId, paramName, latestParamContextName, i);
    });

    trackers = popContext(trackers);
    return trackers;
}

function handleBinaryExpression(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, BinExpNode);

    const newNodeId = createNewObjectNodeVariable(stmtId, stmt.functionContext, variable, trackers);

    deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });
    trackers.graphCreateReferenceEdge(stmtId, newNodeId);

    return trackers;
}

function handleSimpleAssignment(stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    const variableName = trackers.getContextNameList(variable.name, stmt.functionContext).slice(-1)[0];

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, expNode)[0];

    // create map entry
    trackers.addVariableMap(variableName, expNode.obj.name);

    // if the expression does not correspond to an object then
    // we need to create a new object
    if (!storageValue || !StorageFactory.isStorageObject(storageValue)) {
        // const newObjReturn = createAndStoreNewObjectNode(stmtId, stmt, variable, trackers);
        // newTrackers = newObjReturn.newTrackers;
    } else {
        // if the expression corresponds to a known object
        // then we are referencing this object and need to
        // store the identifier of the location
        trackers.addToStore(variableName, storageValue as StorageObject);
    }

    deps.forEach(dep => { trackers.graphCreateReferenceEdge(stmtId, dep.source); });

    return trackers;
}

function handleSequenceAssignment(stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);
    const newNodeId = createNewObjectNodeVariable(stmtId, stmt.functionContext, variable, trackers);

    deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });
    trackers.graphCreateReferenceEdge(stmtId, newNodeId);

    return trackers;
}

function handleTemplateLiteral(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, BinExpNode);

    const newNodeId = createNewObjectNodeVariable(stmtId, stmt.functionContext, variable, trackers);

    deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });
    trackers.graphCreateReferenceEdge(stmtId, newNodeId);

    return trackers;
}

function handleVariableAssignment(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;

    switch (right.type) {
        case "ArrayExpression": {
            return handleArrayExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        case "NewExpression":
        case "CallExpression": {
            return handleCallStatement(stmtId, stmt.functionContext, leftIdentifier, right, config, trackers);
        }

        case "ObjectExpression": {
            return handleObjectExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        case "MemberExpression": {
            return handleMemberExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "FunctionDeclaration": {
            const funcNode = getFDNode(left);
            return handleFunctionDeclaration(stmtId, stmt, funcNode, leftIdentifier, right, trackers);
        }

        case "LogicalExpression":
        case "BinaryExpression": {
            return handleBinaryExpression(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "ThisExpression":
        case "Identifier": {
            return handleSimpleAssignment(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "TemplateLiteral":
            return handleTemplateLiteral(stmtId, stmt, leftIdentifier, right, trackers);

        case "AwaitExpression":
        case "UnaryExpression":
            return handleSimpleAssignment(stmtId, stmt, leftIdentifier, right, trackers);

        case "Literal":
            return trackers; // There are no dependencies from a Literal

        case "SequenceExpression":
            return handleSequenceAssignment(stmtId, stmt, leftIdentifier, right, trackers);

        default:
            console.trace(`Expression ${right.type} didn't match with case values.`);
            return trackers;
    }
}

function handleObjectWrite(stmtId: number, functionContext: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get context names
    const objName = obj.obj.name;
    const objNameContext = trackers.getContextNameList(objName, functionContext).slice(-1)[0];
    let propName = prop.obj.name;

    // get location stored for this object
    // we only need the first because we know this is
    // not a binary expression or member expression
    const sto = evalSto(trackers, obj);
    const objStorage = sto.slice(-1)[0];

    // Evaluate the dependencies for the right side
    let deps = evalDep(trackers, stmtId, right);

    // if the member expression is computed and is not a Literal then we have to evaluate the dependencies
    // of the property as it is a variable, because it influences the object otherwise treat it is a Literal
    if (left.obj.computed && prop.type !== "Literal") {
        const objDeps: Dependency[] = evalDep(trackers, stmtId, prop);
        deps = deps.concat(objDeps.filter((item) => !DependencyFactory.includes(deps, item)));
        // deps = evalDep(trackers, stmtId, prop);
        // deps = [ ...deps, ...evalDep(trackers, stmtId, right) ];

        // change propName to be '*' since the property is dynamic
        propName = '*';
    }

    // if it is an object just evaluate and create new object version
    if (sto.length > 0 && StorageFactory.isStorageObject(objStorage)) {
        // get storage of right-hand side expression. We only need the first because we know this is
        // not a binary expression or member expression
        const rightStorage = evalSto(trackers, right);

        if (rightStorage.length > 0 && StorageFactory.isStorageObject(rightStorage[0])) {
            // if the right hand side is an object
            // we want it to be in the sub object
            const rightStorageValue = rightStorage[0];
            // create new object version node
            // create sub object
            // connect all objects accordingly
            createNewObjectVersionWithStorage(stmtId, objName, objNameContext, propName, rightStorageValue, deps, trackers);
        } else {
            createNewObjectVersion(stmtId, objName, objNameContext, propName, deps, trackers);
        }
    }

    return trackers;
}

function handleAssignmentExpression(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            return handleVariableAssignment(stmtId, stmt, left, right, config, trackers);
        }

        // object write
        case "MemberExpression": {
            return handleObjectWrite(stmtId, stmt.functionContext, left, right, trackers);
        }
        default:
            console.trace(`Expression ${left.type} didn't match with case values.`);
            return trackers.clone();
    }
}

function handleExpressionStatement(stmtId: number, stmt: GraphNode, expNode: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    switch (expNode.type) {
        case "Literal":
        case "Identifier": {
            return trackers.clone();
        //     return handleVariableLookup(stmtId, expNode, trackers);
        }

        case "SequenceExpression": {
            return trackers.clone();
        }

        case "AssignmentExpression": {
            const left = getASTNode(expNode, "left");
            const right = getASTNode(expNode, "right");
            return handleAssignmentExpression(stmtId, stmt, left, right, config, trackers);
        }
        default:
            console.trace(`Expression ${expNode.type} didn't match with case values.`);
            return trackers.clone();
    }
}

function handleReturnArgument(stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, expNode);

    if (deps.length > 0) {
        // create reference edge for value of return
        trackers.graphCreateReferenceEdge(stmtId, deps[0].source);
    }
    // Create edge to the start of the function
    // const functionNode = expNode.functionContext;
    // trackers.graphCreateReturnEdge(deps[0].source, functionNode)

    return trackers;
}

function handleForInStatement(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of right expression
    const deps = evalDep(trackers, stmtId, left);

    // We assume identifiers due to normalization
    if (left.type !== "Identifier") {
        console.trace(`Expression ${left.type} didn't match with case values.`);
        return trackers;
    }
    /*
    if (DependencyFactory.isDEmpty(deps[0])) {
        const newObjReturn = createAndStoreNewObjectNode(left.id, left, left.obj, newTrackers);
        newTrackers = newObjReturn.newTrackers;
        deps = [];
    }
    deps = [...deps, ...evalDep(newTrackers, stmtId, right)];
     */
    const objName = right.obj.name;
    const objNameContextList = trackers.getContextNameList(objName, right.obj.functionContext);
    const validObj = trackers.getValidObject(objNameContextList);
    const objNameContext = validObj ? validObj.name : objNameContextList.slice(-1)[0];
    const propName = '*';

    // Check if subobj exists
    const subObj = trackers.getObjectVersionsWithProp(objName, right.functionContext, propName);

    if (!subObj.length) {
        const subObjId = createSubObject(stmtId, objNameContext, propName, deps, trackers);
        if (subObjId) deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, subObjId, dep) });
    }
    return trackers;
}

function handleForOfStatement(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of left expression
    const deps = evalDep(trackers, stmtId, left);

    // We assume identifiers due to normalization
    if (left.type !== "Identifier") {
        console.trace(`Expression ${left.type} didn't match with case values.`);
        return trackers;
    }

    const objName = right.obj.name;
    const objNameContextList = trackers.getContextNameList(objName, right.obj.functionContext);
    const validObj = trackers.getValidObject(objNameContextList);
    const objNameContext = validObj ? validObj.name : objNameContextList.slice(-1)[0];

    // Check if iterable variable exists
    let varObjId = left.obj.id;

    const varObjContextList = trackers.getContextNameList(left.obj.name, left.obj.functionContext);
    const validVarObj = trackers.getValidObject(varObjContextList)
    if (!validVarObj) {
        varObjId = createNewObjectNodeVariable(stmtId, left.obj.functionContext, left.obj, trackers);
        trackers.graphCreateReferenceEdge(stmtId, varObjId);
        if (varObjId) deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, varObjId, dep) });
    }
    // Create dependency between aux var and iterable array/object
    const rightDeps = evalDep(trackers, stmtId, right);
    if (varObjId) rightDeps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, varObjId, dep) });
    return trackers;
}

function pushContext(trackers: DependencyTracker, context: number): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.pushIntraContext(context);
    return newTrackers;
}

function popContext(trackers: DependencyTracker): DependencyTracker {
    const newTrackers = trackers.clone();
    newTrackers.popIntraContext();
    return newTrackers;
}

export function buildPDG(cfgGraph: Graph, config: Config): PDGReturn {
    const graph = cfgGraph;

    graph.addTaintNode();
    let trackers = new DependencyTracker(graph);

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode, currentNamespace: string | null, curTrackers: DependencyTracker): DependencyTracker {
        if (node === null) return curTrackers;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return curTrackers;
        visitedNodes.push(node.id);

        // check all possible statements after normalization
        switch (node.type) {
            /* CFG nodes: update the intra context stack */
            case "CFG_F_START": {
                if (node.namespace) {
                    curTrackers = pushContext(curTrackers, node.id);
                }
                break;
            }

            case "CFG_IF_END": {
                return curTrackers;
            }

            case "CFG_F_END": {
                curTrackers = popContext(curTrackers);
                break;
            }

            // TODO: TryStatement should pop context?
            case "CFG_TRY_STMT_END":
                break;

            // expression statements are the majority of statements
            case "ExpressionStatement": {
                const expressionNode = getASTNode(node, "expression");
                if (expressionNode) {
                    curTrackers = handleExpressionStatement(node.id, node, expressionNode, config, curTrackers);
                }
                break;
            }

            case "IfStatement": {
                const ifTest = getASTNode(node, "test");

                // in this case we use the id of the test (identifier) node because
                // the CFG "extracts" this node from the AST and inlines it in the
                // control flow
                const deps = evalDep(curTrackers, ifTest.id, ifTest);
                deps.forEach(dep => { curTrackers.graphCreateReferenceEdge(ifTest.id, dep.source); });

                const origStore = curTrackers.storeSnapshot();
                let thenStore: Store = new Map();
                let elseStore: Store = new Map();
                let mergedStore: Store = new Map();

                // if statements must be traversed in a special manner
                // because we need to merge the objects that might be
                // influenced by both branches
                const cfgEdges = ifTest.edges.filter((edge: GraphEdge) => edge.type === "CFG");

                // process then branch
                // until end if node
                const thenEdge = cfgEdges[0];
                curTrackers = traverse(thenEdge.nodes[1], currentNamespace, curTrackers);
                thenStore = curTrackers.storeSnapshot();
                mergedStore = thenStore;

                // process else branch if it exists
                // until end if node
                if (cfgEdges.length > 1) {
                    // restore store to original store before using the edge
                    curTrackers.setStore(origStore);
                    const elseEdge = cfgEdges[1];
                    curTrackers = traverse(elseEdge.nodes[1], currentNamespace, curTrackers);
                    elseStore = curTrackers.storeSnapshot();
                    mergedStore = curTrackers.mergeStores(thenStore, elseStore);
                }

                // set the merge
                curTrackers.setStore(mergedStore);

                // run all remaining cfg nodes after the end if node
                const endIfNodeId = node.cfgEndNodeId;
                if (endIfNodeId > 0) {
                    const endIfNode = graph.nodes.get(endIfNodeId);
                    const nextNode = endIfNode?.edges[0].nodes[1];
                    if (nextNode) curTrackers = traverse(nextNode, currentNamespace, curTrackers);
                }

                return curTrackers;
            }

            case "VariableDeclarator": {
                const initNode = getASTNode(node, "init");
                if (initNode) {
                    curTrackers = handleVariableAssignment(node.id, node, node, initNode, config, curTrackers);
                }
                // else {
                //     // trackers.addVariable(p.obj.name, funcNode.id);
                //     curTrackers = createAndStoreNewObjectNode(node.id, node, node.obj.id, curTrackers).newTrackers;
                // }
                break;
            }

            case "ReturnStatement": {
                const argument = getASTNode(node, "argument");
                if (argument) {
                    curTrackers = handleReturnArgument(node.id, argument, curTrackers);
                }
                break;
            }

            case "CatchClause":
            case "TryStatement":
            case "BlockStatement": {
                break;
            }

            // case "ExportNamedDeclaration": {
            //     const declarations = getAllASTNodes(node, "declaration");
            //     declarations.forEach((decl) => traverse(decl, currentNamespace));
            //     break;
            // }

            // // case "FunctionDeclaration": {
            // //     const params = getAllASTNodes(node, "param");
            // //     params.forEach(p => {
            // //         curTrackers = createAndStoreNewObjectNode(p.id, p.obj.id, curTrackers);
            // //     });
            // //     break;
            // // }

            // case "DoWhileStatement":
            // case "WhileStatement": {
            //     const test = getASTNode(node, "test");

            //     curTrackers = handleWhileStatement(test.id, test, curTrackers);
            //     break;
            // }

            case "ForOfStatement":
            case "ForInStatement": {
                const left = getASTNode(node, "left");
                const right = getASTNode(node, "right");

                curTrackers = handleForOfStatement(node.id, left, right, curTrackers);
                break;
            }
            case "ForInStatement": {
                const left = getASTNode(node, "left");
                const right = getASTNode(node, "right");

                curTrackers = handleForInStatement(node.id, left, right, curTrackers);
                break;
            }

            // // case "ClassDeclaration": {
            // //     const body = getASTNode(node, "body");
            // //     const funcNode = getFDNode(body);
            // //     curTrackers = handleFunctionDeclaration(node.id, node, funcNode, leftIdentifier, right, curTrackers);
            // //     break;
            // // }

            default:
                console.trace(`Expression ${node.type} didn't match with case values.`);
                break;
        }

        // traverse all child CFG nodes
        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                curTrackers = traverse(n, currentNamespace, curTrackers);
            });

        return curTrackers;
    }

    // traverse CFG nodes
    const startNodes = graph.startNodes.get("CFG");
    startNodes?.forEach((node: GraphNode) => {
        trackers = traverse(node, node.namespace, trackers);
    });

    // trackers.print();
    return {
        graph,
        trackers
    };
}

// function handleWhileStatement(stmtId: number, test: GraphNode, trackers: DependencyTracker): DependencyTracker {
//     // clone trackers
//     const newTrackers = trackers.clone();

//     // evaluate dependency of expression
//     let deps = evalDep(trackers, stmtId, test, undefined);

//     // apply dependencies to graph (var edges)
//     newTrackers.graphBuildEdge(deps);

//     return newTrackers;
// }
