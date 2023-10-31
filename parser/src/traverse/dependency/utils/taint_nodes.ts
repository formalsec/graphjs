import * as DependencyFactory from "../dep_factory";
import { type DependencyTracker } from "../structures/dependency_trackers";
import { type Config, type FunctionSink, type PackageSink } from "../../../utils/config_reader";
import { type Dependency } from "../dep_factory";
import { type GraphNode } from "../../graph/node";
import { getASTNode } from "../../../utils/utils";

export function checkIfSink(calleeName: string, functionName: string, context: number, node: GraphNode, deps: Dependency[], stmtId: number, config: Config, trackers: DependencyTracker): void {
    const callASTNode = getASTNode(node, "callee");

    // Check if function sink
    const sinkReference: string | undefined = trackers.getPossibleObjectContexts(functionName, context)
        .find(fc => trackers.checkVariableMap(fc) !== undefined);
    const functionSinkName = sinkReference ? trackers.checkVariableMap(sinkReference) ?? functionName : functionName;
    const functionSinks = config.functions.filter((s) => s.sink === functionSinkName);
    if (functionSinks.length > 0) {
        const sink = functionSinks.slice(-1)[0];
        addFunctionSinkNode(functionSinkName, sink, deps, stmtId, trackers)
        return;
    }

    // Check if package sink
    let sinkName: string = functionName;
    let packageName: string = calleeName;

    if (callASTNode.obj.type === "Identifier") {
        // sink reference checks if the function name is in fact a reference for another variable
        const sinkReference: string | undefined = trackers.getPossibleObjectContexts(functionName, context)
            .find(fc => trackers.checkVariableMap(fc) !== undefined);
        if (sinkReference) {
            const sinkVariableName: string | undefined = trackers.checkVariableMap(sinkReference)
            sinkName = sinkVariableName ? sinkVariableName.split('.')[1] : functionName;
            packageName = sinkVariableName?.split('.')[0] ?? "";
        }
    } else if (callASTNode.obj.type === "MemberExpression") {
        // sink reference checks if the function name is in fact a reference for another variable
        const sinkCalleeReference: string | undefined = trackers.getPossibleObjectContexts(functionName, context)
            .find(fc => trackers.checkVariableMap(fc) !== undefined);
        const sinkPackageReference: string | undefined = trackers.getPossibleObjectContexts(calleeName, context)
            .find(fc => trackers.checkVariableMap(fc) !== undefined);
        if (sinkCalleeReference) {
            sinkName = trackers.checkVariableMap(sinkCalleeReference) ?? functionName;
        }
        if (sinkPackageReference) {
            packageName = trackers.checkVariableMap(sinkPackageReference) ?? calleeName;
        }
    }

    const packageSinks: PackageSink[] = config.packagesSinks.filter((s) => s.sink === sinkName);
    if (packageSinks.length > 0) {
        const sink = packageSinks.slice(-1)[0];
        addPackageSinkNode(sinkName, packageName, sink, deps, stmtId, trackers)
    }
}

function addPackageSinkNode(sinkName: string, packageName: string, sink: PackageSink, dependencies: Dependency[], stmtId: number, trackers: DependencyTracker): void {
    // Check if the sink node already exists for this function
    const checkSink: number | undefined = trackers.graphCheckSinkNode(sinkName);

    const sinkNode: number = trackers.graphAddSinkNode(sinkName).id;

    // connect appropriate arguments to sink node, according to config
    let isSink = false

    const sinkArgs = sink.packages.find(p => p.package === packageName)?.args;
    dependencies.forEach(dep => {
        if (DependencyFactory.isDVar(dep) && dep.arg && sinkArgs?.includes(dep.arg)) {
            trackers.graphConnectToSinkNode(dep.source, dep.name, sinkNode);
            isSink = true
        }
    });

    isSink && trackers.graphCreateSinkEdge(stmtId, sinkNode, sinkName)
}

function addFunctionSinkNode(sinkName: string, sink: FunctionSink, dependencies: Dependency[], stmtId: number, trackers: DependencyTracker): void {
    // Check if the sink node already exists for this function
    const checkSink: number | undefined = trackers.graphCheckSinkNode(sinkName);

    // Create sink node if it does not exist
    const sinkNode: number = trackers.graphAddSinkNode(sinkName).id;

    // connect appropriate arguments to sink node, according to config
    let isSink = false

    dependencies.forEach(dep => {
        if (DependencyFactory.isDVar(dep) && dep.arg && sink.args.includes(dep.arg)) {
            trackers.graphConnectToSinkNode(dep.source, dep.name, sinkNode);
            isSink = true
        }
    });

    isSink && trackers.graphCreateSinkEdge(stmtId, sinkNode, sinkName)
}

export function checkIfSource(propertyLocations: number[], config: Config, trackers: DependencyTracker, stmtId: number, prop: GraphNode): void {
    propertyLocations.forEach((propertyLocation: number) => {
        const packageSources = config.packagesSources.filter((s) => s.source === prop.identifier);
        if (packageSources.length > 0) {
            trackers.addTaintedNodeEdge(propertyLocation, stmtId, -1);
        }
    })
}
