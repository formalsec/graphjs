import { GraphNode } from "../../graph/node";
import { getASTNode } from "../../../utils/utils";
import { type Identifier, type ThisExpression } from "estree";

export function getFunctionName(node: GraphNode): { calleeName: string, functionName: string } {
    const callASTNode = getASTNode(node, "callee");

    let functionName: string, calleeName: string, calleeObj: Identifier | ThisExpression;
    if (callASTNode.obj.type === "MemberExpression") {
        functionName = callASTNode.obj.property.name;
        calleeObj = callASTNode.obj.object;
        if (calleeObj.type === "ThisExpression") calleeName = "this";
        else calleeName = calleeObj.name; // Get callee object name (e.g. arr)
    } else {
        functionName = callASTNode.obj.name;
        calleeObj = callASTNode.obj;
        if (calleeObj.type === "ThisExpression") calleeName = "this";
        else calleeName = calleeObj.name;
    }
    return { calleeName, functionName }
}

export function getObjectNameFromIdentifier(identifier: string | null): string | undefined {
    return identifier?.split('.').pop()?.split('-')[0];

}