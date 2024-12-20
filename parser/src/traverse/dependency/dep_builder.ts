import { type GraphEdge } from "../graph/edge";
import { type Graph } from "../graph/graph";
import { type GraphNode } from "../graph/node";
import { createThisExpression, getAllASTEdges, getAllASTNodes, getASTNode, getFDNode } from "../../utils/utils";
import { DependencyTracker, evalDep, evalSto, type Store } from './structures/dependency_trackers';
import { type Identifier } from "estree";
import * as DependencyFactory from "./dep_factory";
import { type Dependency } from "./dep_factory";
import { type Config } from "../../utils/config_reader";
import { type PackageOperation, type SummaryDependency } from "../../utils/summary_reader";
import { type FContexts } from "../cfg_builder";
import { getFunctionName } from "./utils/nodes";
import { checkIfSink, checkIfSource } from "./utils/taint_nodes";

export interface PDGReturn {
    graph: Graph
    trackers: DependencyTracker
}

/* Evaluate ExpressionStatement */
function handleExpressionStatement(stmtId: number, stmt: GraphNode, expNode: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    switch (expNode.type) {
        case "Literal":
        case "Identifier":
            return trackers.clone();
        case "SequenceExpression": {
            const expressions: GraphEdge[] = getAllASTEdges(expNode, "expression");
            expressions.forEach((edge: GraphEdge) => {
                const expression: GraphNode = edge.nodes[1];
                trackers = handleExpressionStatement(stmtId, stmt, expression, config, trackers);
            });
            return trackers;
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

/* Evaluate ExpressionStatement -> Assignment Expression */
function handleAssignmentExpression(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    switch (left.type) {
        case "Identifier": {
            return handleVariableAssignment(stmtId, stmt, left, right, config, trackers);
        }

        case "MemberExpression": {
            return handleObjectWrite(stmtId, stmt.functionContext, left, right, trackers);
        }
        default:
            console.trace(`Expression ${left.type} didn't match with case values.`);
            return trackers.clone();
    }
}

/* Evaluate ExpressionStatement -> Assignment Expression (x = e), when left is Identifier */
function handleVariableAssignment(stmtId: number, stmt: GraphNode, left: GraphNode, right: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;

    switch (right.type) {
        case "Literal": {
            return trackers;
        }

        // x = e.p
        case "MemberExpression": {
            return handleMemberExpression(stmtId, stmt, leftIdentifier, right, config, trackers);
        }

        // x = [a, b, c]
        case "ArrayExpression": {
            return handleArrayExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
        }

        // x = f() or x = new f()
        case "NewExpression":
        case "CallExpression": {
            return handleCallStatement(stmtId, stmt.functionContext, leftIdentifier, right, config, trackers);
        }

        // x = {}
        case "ObjectExpression": {
            return handleObjectExpression(stmtId, stmt.functionContext, leftIdentifier, right, trackers);
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
        case "AwaitExpression":
        case "UnaryExpression":
        case "ThisExpression":
        case "Identifier": {
            return handleSimpleAssignment(stmtId, stmt, leftIdentifier, right, trackers);
        }

        case "TemplateLiteral":
            return handleTemplateLiteral(stmtId, stmt, leftIdentifier, right, trackers);

        case "SequenceExpression":
            return handleSequenceAssignment(stmtId, stmt, leftIdentifier, right, trackers);

        default:
            console.trace(`Expression ${right.type} didn't match with case values.`);
            return trackers;
    }
}

/* Evaluates x = e.p */
function handleMemberExpression(stmtId: number, stmt: GraphNode, variable: Identifier, memExpNode: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(memExpNode, "object");
    const prop = getASTNode(memExpNode, "property");

    const objName = obj.obj.name;
    const propName = (memExpNode.obj.computed && prop.type !== "Literal") ? '*' : prop.obj.name; // dynamic property
    const objectLocations: number[] = trackers.storeGetObjectLocations(objName, memExpNode.functionContext)

    if (objName === "module" && propName === "exports") {
        trackers.addModuleExportsAlias(variable.name);
    }

    // It may happen that we are using a "global" obj such as exports that is supposed to exist in the scope
    if (!objectLocations.length && obj.type === "Identifier") {
        objectLocations.push(trackers.createNewObject(stmtId, stmt.functionContext, obj.obj))
    }

    // evaluate dependency of expression
    const deps: Dependency[] = evalDep(trackers, stmtId, memExpNode);

    // Add Prop
    const propertyLocations: number[] = trackers.addProp(objectLocations, objName, propName, stmt.functionContext, stmtId, deps)
    checkIfSource(propertyLocations, config, trackers, stmtId, prop)

    objectLocations.forEach((location: number) => {
        const objectLocation: GraphNode | undefined = trackers.graphGetNode(location);
        const propertyLocation: GraphNode | undefined = trackers.graphGetObjectPropertyLocation(location, propName);
        if (propertyLocation && objectLocation && objectLocation.propertyDependencies?.length > 0) {
            deps.push(...objectLocation.propertyDependencies)
        }
    })

    // If variable is an object being redefined
    const variableLocations: number[] = trackers.storeGetObjectLocations(variable.name, memExpNode.functionContext)
    if (variableLocations.length) {
        variableLocations.forEach((location: number, index: number) => {
            trackers.storeUpdateLocation(variable.name, location, [propertyLocations[index]], stmt.functionContext)
        })
    } else {
        propertyLocations.forEach((location: number) => {
            trackers.storeAddLocation(variable.name, location, stmt.functionContext)
        })
    }

    // If right side of the assignment (memExpNode) is the argument keyword referring to the function arguments, we need to create the object corresponding to the left side
    if (!propertyLocations.length && obj.obj.name === "arguments") {
        const newObjectAssigned: number | undefined = trackers.checkAssignment(stmtId, `obj_${variable.name}`)
        if (!newObjectAssigned) {
            const subObjId = trackers.createNewObject(stmtId, stmt.functionContext, variable)
            propertyLocations.push(subObjId)
            deps.forEach((dep: Dependency) => {
                trackers.graphCreateDependencyEdge(dep.source, subObjId, dep)
            })
            // If there are no dependencies from the pre-defined arguments, then, we need to taint the left side object
            const functionNode: GraphNode | undefined = trackers.getFunctionNode(stmt.functionContext);
            const index = prop.type === "Literal" && typeof prop.obj.value === "number" ? prop.obj.value : undefined;
            if (functionNode) trackers.addTaintedNodeEdge(subObjId, functionNode.id, index)
        }
    }

    // Add variable reference to variable map
    const variableReference: string | undefined = trackers.getPossibleObjectContexts(objName, stmt.functionContext)
        .find(fc => trackers.checkVariableMap(fc) !== undefined);
    if (variableReference && prop.type === "Identifier") {
        const variableNameContext: string = trackers.checkVariableMap(variableReference) ?? "?"
        const functionMap = `${variableNameContext}.${prop.obj.name as string}`
        trackers.addVariableMap(`${stmt.functionContext}.${variable.name}`, functionMap);
    }

    return trackers;
}

function handleArrayExpression(stmtId: number, functionContext: number, variable: Identifier, arrExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // Check if object/array already exists
    const locations = trackers.storeGetObjectLocations(variable.name, functionContext)

    if (!locations.length) {
        const location: number = trackers.createNewObject(stmtId, functionContext, variable)
        locations.push(location)
    }

    const arrElementEdges = getAllASTEdges(arrExpNode, "element");
    arrElementEdges.forEach((edge) => {
        const elementIndex = edge.elementIndex;
        const element = edge.nodes[1];
        trackers = handleArrayExpressionElement(stmtId, functionContext, variable, element, elementIndex, trackers);
    });

    return trackers;
}

function handleCallStatement(stmtId: number, functionContext: number, variable: Identifier, callNode: GraphNode, config: Config, trackers: DependencyTracker): DependencyTracker {
    // Get function name (depends on the type of callee --> MemberExpression or Identifier)
    const { calleeName, functionName } = getFunctionName(callNode)
    const callName: string = calleeName !== functionName ? calleeName + '.' + functionName : functionName
    // Create a node that corresponds to the call
    const callNodeObjId: number = trackers.createNewObject(stmtId, functionContext,
        { type: "Identifier", name: "CALL->" + callName }, "PDG_CALL");
    const callNodeObj: GraphNode | undefined = trackers.graphGetNode(callNodeObjId);

    // Ensure that the object has the same information as the AST node
    const calledFunc: number = callNode.edges.find((e: GraphEdge): boolean => e.type === "CG")?.nodes[1].id ?? -1;

    if (callNodeObj) {
        callNodeObj.functionContext = functionContext;
        callNodeObj.functionName = callName;
        callNodeObj.edges = callNode.edges;
        trackers.graphCreateCallEdge(callNodeObjId, calledFunc);
        const funcNode = trackers.getFunctionNode(functionContext);
        if (funcNode) {
            const funcNodeId = funcNode.id;
            const funcNodeName = funcNode.identifier;
            funcNodeId && trackers.graphCreateCallRefEdge(funcNodeId, callNodeObjId);
            funcNodeName && trackers.declaredFuncsMap.set(funcNodeName, funcNode);
        }
        trackers.addCallNode(callNodeObj);
        const ids: number[] = []
        callNode.obj.arguments.forEach((arg: any, _: number) => {
            if (arg.type === "Identifier") {
                const argLocation: number = trackers.storeGetObjectLocations(arg.name, callNode.functionContext).slice(-1)[0];
                ids.push(argLocation);
            } else {
                ids.push(-1);
            }
        });
        callNodeObj.addArgsObjIds(ids);
    }

    let success: boolean;
    // Map call arguments (variables passed to the call map to the arguments of the called function definition)
    [trackers, success] = mapCallArguments(callNode, functionContext, functionName, calleeName, stmtId, config, trackers, callNodeObj);

    // Create new object for the new variable (return of the call)
    const returnLocation = trackers.createNewObject(stmtId, functionContext, variable);
    trackers.graphCreatePDGReturnEdge(callNodeObjId, returnLocation);

    // Process dependencies of the call
    const deps: Dependency[] = evalDep(trackers, stmtId, callNode); // Dependencies of the arguments

    // 1. If callee is not a member expression, create dependencies from the arguments to the return object
    if (callNode.obj.callee.type !== "MemberExpression") {
        /* empty */
    } else if (callNode.obj.callee.type === "MemberExpression") {
        // Get callee object (e.g. path in path.call(args))
        let latestCalleeObj = trackers.graphGetNode(trackers.storeGetObjectLocations(calleeName, callNode.functionContext).slice(-1)[0])
        // Get summary for the function
        const functionSummary: SummaryDependency[] | undefined = config.summaries.arrays.get(functionName);
        // If function summary exists, process dependencies according to summary
        if (latestCalleeObj && functionSummary?.length) {
            /* empty */
        } else { // If function summary does not exist
            // Check if this call is a call of package with a summary or a package that was lazy required
            const lazyFunctionName: string | undefined = trackers.checkIfLazyCall(calleeName, functionName);
            const lazyPackageSummary: PackageOperation[] | undefined = lazyFunctionName ? config.summaries.packages.get(lazyFunctionName) : undefined;
            if (lazyPackageSummary) {
                trackers.translateOperations(lazyPackageSummary, callNode, functionContext, stmtId)
            } else { // If the callee is not a package with a summary, process all dependencies
                if (latestCalleeObj && latestCalleeObj.id === returnLocation) {
                    latestCalleeObj = trackers.graphGetNode(trackers.getObjectVersions(calleeName, callNode.functionContext).slice(-2)[0]);
                }
                // Dependency callee <-- arguments
                // We filter the deps to avoid having cycles in dependencies, e.g. orig = utils.escape(orig);
                const acycleDeps = deps.filter((dep: Dependency) => dep.source !== returnLocation)
                // Check if callee is an imported package
                if (latestCalleeObj && !trackers.checkRequireChain(latestCalleeObj.identifier)) {
                    acycleDeps.forEach(d => {
                        if (latestCalleeObj && d.source !== latestCalleeObj.id) trackers.graphCreateDependencyEdge(d.source, latestCalleeObj.id, d)
                    })
                }

                if (latestCalleeObj) {
                    const subObj: GraphNode | undefined = trackers.graphGetObjectPropertyLocation(latestCalleeObj.id, functionName);
                    const calledFunc: GraphNode | undefined = subObj?.edges.find(e => e.type === "CG")?.nodes[1];
                    if (calledFunc) {
                        trackers.graphCreateCallEdge(stmtId, calledFunc.id);
                        callNodeObj && trackers.graphCreateCallEdge(callNodeObj.id, calledFunc.id);
                        [trackers, success] = mapCallArguments(callNode, functionContext, functionName, calleeName, stmtId, config, trackers, callNodeObj);
                    }
                    callNodeObj && trackers.graphCreateArgumentEdge(latestCalleeObj.id, callNodeObj.id, "ARG", "this");
                }
            }
        }
    }

    // Sometimes the function is not defined in the code, might be a method of an object (ie., path.join())
    // in this cases, the parameter in question cannot be mapped to the function arguments, thus
    // we assign the value of * to the parameter to ensure that taint paths aren't lost
    if (!success) {
        const callArgs: GraphNode[] = getAllASTNodes(callNode, "arg");
        callArgs.forEach((callArg: GraphNode) => {
            if (callArg.identifier) {
                const callArgumentLocations: number[] = trackers.getObjectVersions(callArg.identifier, callNode.functionContext);
                callArgumentLocations.forEach((location: number) => {
                    const callArgumentNode = trackers.graphGetNode(location);
                    if (callArgumentNode?.identifier) {
                        callNodeObj && trackers.graphCreateArgumentEdge(callArgumentNode.id, callNodeObj.id, "ARG", "undefined");
                    }
                });
            }
        });
    }

    checkIfSink(calleeName, functionName, functionContext, callNode, deps, stmtId, config, trackers)

    // Create sinks when promisify(exec) e.g.
    const varDeps = deps.filter(dep => DependencyFactory.isDVar(dep));
    varDeps.forEach(dep => {
        const variableMap = trackers.checkVariableMap(`${callNode.functionContext}.${dep.name}`)
        if (variableMap) trackers.addVariableMap(`${callNode.functionContext}.${variable.name}`, variableMap);
    })

    // Check requires
    trackers.checkRequires(functionName, callNode, variable)

    return trackers;
}

function handleObjectExpression(stmtId: number, functionContext: number, variable: Identifier, _objExp: GraphNode, trackers: DependencyTracker): DependencyTracker {
    trackers.createNewObject(stmtId, functionContext, variable)
    return trackers;
}

function handleFunctionDeclaration(stmtId: number, stmt: GraphNode, funcNode: GraphNode, funcIdentifier: Identifier, funcExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // add context so that params are in the context of funcNode execution
    trackers = pushContext(trackers, funcNode.id);

    // Create the ThisObject for all function
    trackers.createNewObject(stmtId, funcNode.functionContext, createThisExpression());

    // track all parameters of this function
    const unpatternedParams = getAllASTNodes(funcExpNode, "param");
    // in case a parameter is an object expression
    const params: GraphNode[] = []
    unpatternedParams.forEach(p => {
        if (p.type === "ObjectPattern") {
            const objParams = getAllASTNodes(p, "property").map(prop => getASTNode(prop, "value"));
            params.push(...objParams)
        } else params.push(p)
    })

    // create param node and connect to taint source
    params.forEach((p: GraphNode, i: number) => { trackers.addParamNode(stmtId, p, i, funcExpNode, funcNode.id); });

    trackers.addDeclaredFunc(funcIdentifier.name, stmt);
    // Create node for return object
    // First, check if object exists (cases where the function is exported before defined)
    const funcObjectIdentifiers: number[] = trackers.getObjectVersions(funcIdentifier.name, stmt.functionContext)
    if (funcObjectIdentifiers.length) {
        funcObjectIdentifiers.forEach((funcObjectIdentifier: number) => {
            trackers.graphCreateReferenceEdge(stmtId, funcObjectIdentifier, funcIdentifier.name)
        })
    } else {
        trackers.createNewObject(stmtId, stmt.functionContext, funcIdentifier);
    }
    trackers = popContext(trackers);
    return trackers;
}

function handleBinaryExpression(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // If expression is ||, create new object or update existing object with two versions instead of dependencies
    if (BinExpNode.type === "LogicalExpression" && BinExpNode.obj.operator === "||" && BinExpNode.obj.right.type === "Identifier" && BinExpNode.obj.left.type === "Identifier") {
        // Get right side objects
        const rightBinExpNode: number[] = trackers.getObjectVersions(BinExpNode.obj.right.name, stmt.functionContext)
        // Get left side objects
        const leftBinExpNode: number[] = trackers.getObjectVersions(BinExpNode.obj.left.name, stmt.functionContext)
        const binExpNodeVersions: number[] = [...rightBinExpNode, ...leftBinExpNode]

        // Check if object exists
        const returnObjectVersions: number[] = trackers.getObjectVersions(variable.name, stmt.functionContext)
        // If object exists, update store
        if (returnObjectVersions.length) {
            returnObjectVersions.forEach((returnObj: number) => {
                trackers.storeUpdateLocation(variable.name, returnObj, binExpNodeVersions, stmt.functionContext)
            })
        } else { // If object does not exist, create object with store
            binExpNodeVersions.forEach((location: number) => {
                trackers.storeAddLocation(variable.name, location, stmt.functionContext)
            })
        }
    } else {
        // Evaluate dependency of expression
        const deps = evalDep(trackers, stmtId, BinExpNode);
        const newNodeId = trackers.createNewObject(stmtId, stmt.functionContext, variable);
        deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });
    }

    return trackers;
}

function handleSimpleAssignment(_stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // Update store
    const locations: number[] = evalSto(trackers, expNode);
    locations.forEach((location: number) => {
        trackers.storeAddLocation(variable.name, location, stmt.functionContext)
    })
    if (expNode.identifier === "exports") {
        trackers.addExportsAlias(variable.name);
    }

    // create map entry
    trackers.addVariableMap(variable.name, expNode.obj.name);

    return trackers;
}

function handleTemplateLiteral(stmtId: number, stmt: GraphNode, variable: Identifier, BinExpNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // Update store
    const newNodeId = trackers.createNewObject(stmtId, stmt.functionContext, variable);

    // Evaluate dependencies
    const deps = evalDep(trackers, stmtId, BinExpNode);
    deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });

    return trackers;
}

function handleSequenceAssignment(stmtId: number, stmt: GraphNode, variable: Identifier, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // Update store
    const newNodeId = trackers.createNewObject(stmtId, stmt.functionContext, variable);

    // Evaluate dependencies
    const deps = evalDep(trackers, stmtId, expNode);
    deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newNodeId, dep); });

    return trackers;
}

function handleObjectWrite(stmtId: number, functionContext: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");

    // get context names
    const objName = obj.obj.name;
    let propName = prop.obj.name;

    // exports.a  = function() {}
    if (objName === "exports" || trackers.exportsAliasSet.has(objName)) {
        trackers.addExportsAssignment(propName, right);
    } else if (objName === "module" && propName === "exports") {
        trackers.setModuleExportsIdentifier(right.obj.name);
    } else if (trackers.moduleExportsAliasesSet.has(objName)) {
        trackers.addModuleExportsAssignment(propName, right);
    }

    const objectLocations: number[] = evalSto(trackers, obj);

    // It may happen that the right side is a function that wasn't defined yet.
    // For that reason, if the right side is an identifier and does not exist in the store,
    // we create an object preemptively
    const rightLocations: number[] = evalSto(trackers, right);
    if (!rightLocations.length && right.type === "Identifier") {
        trackers.createNewObject(stmtId, functionContext, right.obj)
    }
    // Evaluate the dependencies for the right side
    let deps: Dependency[] = evalDep(trackers, stmtId, right);

    // if the member expression is computed and is not a Literal then we have to evaluate the dependencies
    // of the property as it is a variable, because it influences the object otherwise treat it is a Literal
    if (left.obj.computed && prop.type !== "Literal") {
        const objDeps: Dependency[] = evalDep(trackers, stmtId, prop, undefined, true);
        deps = deps.concat(objDeps.filter((item) => !DependencyFactory.includes(deps, item)));
        // change propName to be '*' since the property is dynamic
        propName = '*';
    }

    // If the object exists, we create a new version, if the object does not exist, we create the object with the property
    // This may happen if the object variable is not yet perceived as an object but already existed in the program
    if (objectLocations.length > 0) {
        trackers.addVersion(stmtId, objName, functionContext, propName, deps);
    } else {
        const rightLocations: number[] = evalSto(trackers, right);
        // Only create new object if relevant (right side is also an object)
        if (rightLocations.length) { // If object does not exist yet
            const newObjId: number = trackers.createNewObject(stmtId, functionContext, obj.obj);
            const subObjId = trackers.addProp([newObjId], obj.obj.name, propName, functionContext, stmtId)
            deps.forEach((dep: Dependency) => {
                trackers.graphCreateDependencyEdge(dep.source, subObjId[0], dep)
            });
        }
    }

    if (right.type === "Identifier") {
        const func = trackers.getFunctionNodeFromName(right.obj.name);
        const subObjId = trackers.graphGetObjectPropertyLocation(
            trackers.storeGetObjectLocations(objName, functionContext)[0], propName)?.id;
        if (func && subObjId) { // if the property is assigned to a function, add the corresponding call edge
            trackers.graphCreateCallEdge(subObjId, func.id);
        } else if (subObjId) { // if the property is being assigned to an object, add its properties as sub objects
            const rightLocation: number = evalSto(trackers, right).slice(-1)[0];
            const rightNode = trackers.graphGetNode(rightLocation);

            const subObjs = rightNode?.edges.filter((edge: GraphEdge) => edge.type === "PDG" &&
            edge.label === "SO");

            subObjs?.forEach((edge: GraphEdge) => {
                trackers.graphCreatePropertyEdge(subObjId || -1, edge.nodes[1].id, edge.objName);
            });
        }
    }
    return trackers;
}

function handleForInStatement(stmtId: number, left: GraphNode, right: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of right expression
    const deps = evalDep(trackers, stmtId, right);

    // We assume identifiers due to normalization
    if (left.type !== "Identifier") {
        console.trace(`Expression ${left.type} didn't match with case values.`);
        return trackers;
    }

    const objName = right.obj.name;
    const propName = '*';

    // Check if sub-obj exists
    const subObj: number[] = trackers.graphGetObjectVersionsPropertyLocations(objName, right.functionContext, propName)

    if (!subObj.length) {
        const newObjId = trackers.createNewObject(stmtId, right.functionContext, left.obj)
        deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, newObjId, dep) });
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
    // Check if iterable variable exists
    const locations = trackers.storeGetObjectLocations(left.obj.id, left.functionContext)

    if (locations.length === 0) {
        const varObjId = trackers.createNewObject(stmtId, left.functionContext, left.obj);
        deps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, varObjId, dep) });
        locations.push(varObjId)
    }

    locations.forEach((location: number) => {
        // Create dependency between aux var and iterable array/object
        const rightDeps = evalDep(trackers, stmtId, right);
        rightDeps.forEach(dep => { trackers.graphCreateDependencyEdge(dep.source, location, dep) });
    })

    return trackers;
}

function handleArrayExpressionElement(stmtId: number, functionContext: number, variable: Identifier, elemNode: GraphNode, elementIndex: number, trackers: DependencyTracker): DependencyTracker {
    const variableName = variable.name;

    // evaluate dependency of expression
    const deps = evalDep(trackers, stmtId, elemNode);

    // check if this expression is already in storage
    // we only need the first because we know this is
    // not a binary expression or member expression
    const storageValue = evalSto(trackers, elemNode)[0];

    createArrayElement(stmtId, variableName, functionContext, elementIndex, storageValue, deps, trackers);

    return trackers;
}

function createArrayElement(stmtId: number, objName: string, context: number, elementIndex: number, _propValue: number, deps: Dependency[], trackers: DependencyTracker): void {
    const locations = trackers.storeGetObjectLocations(objName, context)
    const propName = elementIndex.toString();

    const propertyLocations: number[] = trackers.addProp(locations, objName, propName, context, stmtId)

    propertyLocations.forEach((location: number) => {
        deps.forEach(dep => {
            trackers.graphCreateDependencyEdge(dep.source, location, dep);
        });
    })
    locations.forEach((location: number) => {
        deps.forEach(dep => {
            trackers.graphCreateDependencyEdge(dep.source, location, dep);
        });
    })
}

/*
 * This function is responsible for mapping the variables that exist in a function to the arguments of a called function.
 * E.g.
 * function f2(b) {}
 * function f1(a) {
 *      const aux = a + 2;
 *      f2(aux);
 * }
 * This function maps f1.aux to f2.b
 */
function mapCallArguments(callNode: GraphNode, _functionContext: number, callName: string, calleeName: string, stmtId: number, config: Config, trackers: DependencyTracker,
    callNodeObj: GraphNode | undefined): [DependencyTracker, boolean] {
    const callArgs: GraphNode[] = getAllASTNodes(callNode, "arg");
    const callASTNode: GraphNode = getASTNode(callNode, "callee");
    let success: boolean = false;

    // Check the function type. If type is Identifier, it's a "callable" function, if type is a MemberExpression, then it's a function called upon an object, and we don't map the arguments
    if (callASTNode.type === "Identifier") {
        // Get graph node (calledNode) of the called function (to get the params)
        const calledFunctions: GraphEdge[] = callNode.edges.filter((edge: GraphEdge) => edge.type === "CG" && edge.nodes[1].identifier === calleeName)
        if (calledFunctions.length) {
            const calledNode: GraphNode = calledFunctions[0].nodes[1];
            // Get graph nodes of the params of the called function
            const calledArgNodes: GraphNode[] = calledNode.edges.filter((edge: GraphEdge) => edge.type === "REF" && edge.label === "param" && edge.paramIndex >= 0).map((edge: GraphEdge) => edge.nodes[1])
            if (calledArgNodes.length) {
                // We iterate by the arguments of the statement with the call (variables) because some invocations don't have all the arguments
                callArgs.forEach((callArg: GraphNode, i: number) => {
                    if (callArg.identifier !== null) {
                        const callArgumentLocations: number[] = trackers.getObjectVersions(callArg.identifier, callNode.functionContext);
                        callArgumentLocations.forEach((location: number) => {
                            const callArgumentNode = trackers.graphGetNode(location);
                            if (callArgumentNode?.identifier && calledArgNodes.length > i) {
                                callNodeObj && trackers.graphCreateArgumentEdge(callArgumentNode.id, callNodeObj.id, "ARG", calledArgNodes[i].identifier ?? undefined);
                                success = true;
                            }
                        });
                    }
                });
            }
        }
    } else if (callASTNode.type === "MemberExpression") { // Check if argument of call is an inner function
        // Check if call edge exist or if function is js native, otherwise we don't know its behaviour, so, we do not map
        const auxiliaryFunctionSummary: boolean = config.summaries.auxiliary_functions.includes(callName);
        if (auxiliaryFunctionSummary) {
            // Get arguments that are functions
            // @ts-ignore
            const innerFunctions: GraphNode[] = callArgs.filter(arg => arg.identifier != null)
                .map(arg => trackers.getFunctionNodeFromName(arg.identifier ?? "?"))
                .filter((fn: GraphNode | undefined) => fn !== undefined)
            // Get arguments that are variables
            // const varFunctions = callArgs.filter(arg => !anonFunctionsIds.includes(arg.id))

            // We need to map the anonFuncArgs - each anon function arg depends on the callee node obj and arguments of functions   TODO: summary for this
            innerFunctions.forEach((fnNode: GraphNode) => {
                // PDG arguments from the inner function
                const calledArgNodes: GraphNode[] = fnNode.edges.filter((edge: GraphEdge) => edge.type === "REF" && edge.label === "param").map((edge: GraphEdge) => edge.nodes[1])
                calledArgNodes.forEach((arg: GraphNode) => {
                    const callArgumentLocation = trackers.getObjectVersions(calleeName, callNode.functionContext).slice(-1)[0];
                    const callArgumentNode: GraphNode | undefined = trackers.graphGetNode(callArgumentLocation)
                    if (callArgumentNode) {
                        trackers.graphCreatePropertyEdge(callArgumentNode.id, arg.id, '*')
                    }
                });
            });
            return [trackers, success];
        } else {
            // Get graph node (calledNode) of the called function (to get the params)
            const calledFunctions: GraphNode[] = trackers.graphGetNode(stmtId)?.edges.filter((edge: GraphEdge) => edge.label === "CG").map((edge: GraphEdge) => edge.nodes[1]) ?? []
            if (calledFunctions.length) {
                const calledNode: GraphNode = calledFunctions[0];
                // Get graph nodes of the params of the called function
                const calledArgNodes: GraphNode[] = calledNode.edges.filter((edge: GraphEdge) => edge.type === "REF" && edge.label === "param" && edge.paramIndex >= 0).map((edge: GraphEdge) => edge.nodes[1])
                if (calledArgNodes.length) {
                    // We iterate by the arguments of the statement with the call (variables) because some invocations don't have all the arguments
                    callArgs.forEach((callArg: GraphNode, i: number) => {
                        let callArgumentNode;
                        if (callArg.identifier !== null) {
                            const callArgumentLocation = trackers.getObjectVersions(callArg.identifier, callNode.functionContext).slice(-1)[0];
                            callArgumentNode = trackers.graphGetNode(callArgumentLocation)
                        }
                        if (callArgumentNode?.identifier && calledArgNodes.length > i) {
                            callNodeObj && trackers.graphCreateArgumentEdge(callArgumentNode.id, callNodeObj.id, "ARG", calledArgNodes[i].identifier ?? undefined);
                            success = true;
                        }
                    });
                }
            }
        }
    }

    return [trackers, success];
}

function handleReturnArgument(_stmtId: number, expNode: GraphNode, trackers: DependencyTracker): DependencyTracker {
    // evaluate dependency of expression
    const deps: Dependency[] = evalDep(trackers, _stmtId, expNode);

    // Create edge to the start of the function
    const newObjId: number = trackers.createNewObject(_stmtId, expNode.functionContext,
        { type: "Identifier", name: "RET_OBJ" }, "PDG_RETURN");

    deps.forEach((dep: Dependency) => {
        const depNode: number = trackers.storeGetObjectLocations(dep.name, expNode.functionContext).slice(-1)[0];
        trackers.graphCreateDependencyEdge(depNode, newObjId, dep);
    });

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

export function buildPDG(cfgGraph: Graph, functionContexts: FContexts, config: Config): PDGReturn {
    const graph: Graph = cfgGraph;

    graph.addTaintNode();
    let trackers: DependencyTracker = new DependencyTracker(graph, functionContexts);

    const visitedNodes: number[] = [];

    function traverse(node: GraphNode, currentNamespace: string | null, curTrackers: DependencyTracker, isLoop: boolean): DependencyTracker {
        if (node === null) return curTrackers;

        // to avoid duplicate traversal of a node with more than one "from" CFG edge
        if (visitedNodes.includes(node.id)) return curTrackers;
        if (!isLoop) visitedNodes.push(node.id);

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
                curTrackers = traverse(thenEdge.nodes[1], currentNamespace, curTrackers, isLoop);
                thenStore = curTrackers.storeSnapshot();
                mergedStore = thenStore;

                // process else branch if it exists
                // until end if node
                if (cfgEdges.length > 1) {
                    // restore store to original store before using the edge
                    curTrackers.setStore(origStore);
                    const elseEdge = cfgEdges[1];
                    curTrackers = traverse(elseEdge.nodes[1], currentNamespace, curTrackers, isLoop);
                    elseStore = curTrackers.storeSnapshot();
                    mergedStore = curTrackers.storeMergeStores(thenStore, elseStore);
                }

                // set the merge
                curTrackers.setStore(mergedStore);

                // run all remaining cfg nodes after the end if node
                const endIfNodeId = node.cfgEndNodeId;
                if (endIfNodeId > 0) {
                    const endIfNode = graph.nodes.get(endIfNodeId);
                    const nextNode = endIfNode?.edges[0].nodes[1];
                    if (nextNode) curTrackers = traverse(nextNode, currentNamespace, curTrackers, isLoop);
                }

                return curTrackers;
            }

            case "VariableDeclarator": {
                const initNode = getASTNode(node, "init");
                if (initNode) {
                    curTrackers = handleVariableAssignment(node.id, node, node, initNode, config, curTrackers);
                } else {
                    curTrackers.createNewObject(node.id, node.functionContext, node.obj.id);
                }
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

            case "ForOfStatement": {
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

            case "WhileStatement": {
                node.edges
                    .filter((edge: GraphEdge) => edge.type === "CFG")
                    .forEach((edge: GraphEdge) => {
                        const n = edge.nodes[1];
                        curTrackers = traverse(n, currentNamespace, curTrackers, true);
                    });
                break;
            }

            default:
                console.trace(`Expression ${node.type} didn't match with case values.`);
                break;
        }

        // traverse all child CFG nodes
        node.edges
            .filter((edge: GraphEdge) => edge.type === "CFG")
            .forEach((edge: GraphEdge) => {
                const n = edge.nodes[1];
                curTrackers = traverse(n, currentNamespace, curTrackers, isLoop);
            });

        return curTrackers;
    }

    // traverse CFG nodes
    const startNodes = graph.startNodes.get("CFG");
    startNodes?.forEach((node: GraphNode) => {
        trackers = traverse(node, node.namespace, trackers, false);
    });

    // trackers.print();
    return {
        graph,
        trackers
    };
}
