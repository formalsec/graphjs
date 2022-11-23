import { Identifier } from "estree";
import { getAllASTNodes, getASTNode } from "../utils/utils";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";

export type FObjects = Map<string, Map<string, any>>;

export class FunctionObjects {
    private _fObjects: FObjects;

    constructor() {
        this._fObjects = new Map();
    }

    addParam(functionId: number, paramName: string) {
        const paramObj = new Map();

        paramObj.set(paramName, {
            "type": "symbolic",
        });

        this._fObjects.set(functionId.toString(), paramObj);
    }

    addVariableTypeInfo(functionId: number, variableName: string, typeInfo: any) {
        let functionVariables = this._fObjects.get(functionId.toString());

        if (!functionVariables) {
            functionVariables = new Map();
        }

        functionVariables?.set(variableName, typeInfo);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addVariableSymbolic(functionId: number, variableName: string) {
        let functionVariables = this._fObjects.get(functionId.toString());

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let varType = {
            "type": "symbolic",
        };

        functionVariables?.set(variableName, varType);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addObjectPropertyTypeInfo(functionId: number, objName: string, propName: string, typeInfo: any) {
        let functionVariables = this._fObjects.get(functionId.toString());

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let obj: any = createType("object");

        if (functionVariables?.has(objName)) {
            obj = functionVariables.get(objName);
            obj["properties"][propName] = typeInfo;
        }

        functionVariables?.set(objName, obj);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addObjectPropertySymbolic(functionId: number, objName: string, propName: string) {
        let functionVariables = this._fObjects.get(functionId.toString());

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let obj: any = createType("object");
        obj["properties"][propName] = {
            "type": "symbolic",
        }

        functionVariables?.set(objName, obj);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    setFObjects(newFObjects: FObjects) {
        this._fObjects = newFObjects;
    }

    getFunctionObjects(functionId: number) {
        return this._fObjects.get(functionId.toString());
    }

    print() {
        for (const [func, vars] of this._fObjects.entries()) {
            console.log(`== ${func} ==`);
            for (const [varName, obj] of vars.entries()) {
                console.log(`\t${varName}: ${JSON.stringify(obj)}`);
            }
        }
    }

    clone(): FunctionObjects {
        const clone = new FunctionObjects();
        clone.setFObjects(this._fObjects);
        return clone;
    }

}

function createType(type: string, prop_type: string = "prop_string") {
    switch(type) {
        case "object": {
            return {
                "type": "object",
                "properties": {},
            };
        }

        case "array": {
            return {
                "type": "array",
                "prop_type": prop_type,
            };
        }

        default: {
            return {
                "type": type,
            };
        }
    }
}

export function buildTypesFromSimpleAssignment(left: Identifier, right: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();
    const funcObjects = newFObjects.getFunctionObjects(functionId);
    if (!funcObjects) return newFObjects;

    switch (right.type) {
        case "Literal": {
            let typeInfo = typeof right.obj.value;
            const typeObj = createType(typeInfo);
            newFObjects.addVariableTypeInfo(functionId, left.name, typeObj);
            break;
        }

        case "Identifier": {
            const typeInfo = funcObjects.get(right.obj.name);

            if (typeInfo) {
                if (Object.keys(typeInfo).includes("type")) {
                    const typeObj = createType(typeInfo["type"]);
                    newFObjects.addVariableTypeInfo(functionId, left.name, typeObj);
                }
            } else {
                newFObjects.addVariableSymbolic(functionId, left.name);
            }
            break;
        }

        case "ArrayExpression": {
            let arrayObj = createType("array");
            const elements = getAllASTNodes(right, "element");
            if (elements.length > 0) {
                const elementType = typeof elements[0].obj.value
                arrayObj = createType("array", elementType);
            }
            newFObjects.addVariableTypeInfo(functionId, left.name, arrayObj);
            break;
        }

        case "ObjectExpression": {
            const objectObj = createType("object");
            newFObjects.addVariableTypeInfo(functionId, left.name, objectObj);
            break;
        }

        case "MemberExpression": {
            // get child nodes for the member expression
            const obj = getASTNode(right, "object");
            const prop = getASTNode(right, "property");
            const objName = obj.obj.name;
            const propName = prop.obj.name;
            const objStructure = funcObjects.get(objName);
            if (objStructure) {
                let typeInfo = createType("symbolic");
                if (objStructure["type"] == "object") {
                    const properties = objStructure["properties"];
                    typeInfo = properties[propName];
                } else if (objStructure["type"] == "array"){
                    // obj structure is array, we need prop_type
                    typeInfo = objStructure["prop_type"];
                } else {
                    // obj structure is symbolic, we need to change it to object
                    const objTypeInfo = createType("object");
                    fObjects.addVariableTypeInfo(functionId, objName, objTypeInfo);
                    fObjects.addObjectPropertySymbolic(functionId, objName, propName);
                }

                fObjects.addVariableTypeInfo(functionId, left.name, typeInfo);

            } else {
                fObjects.addVariableSymbolic(functionId, left.name);
            }
            break;
        }

        // case "BinaryExpression": {
        //     return handleBinaryExpression(stmtId, stmt, leftIdentifier, right, trackers);
        // }
    }

    return newFObjects;
};

export function buildTypesFromObjectWrite(left: GraphNode, right: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();

    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");
    const objName = obj.obj.name;
    const propName = prop.obj.name;

    switch (right.type) {
        case "Literal": {
            let typeInfo = typeof right.obj.value;
            const typeObj = createType(typeInfo);
            newFObjects.addObjectPropertyTypeInfo(functionId, objName, propName, typeObj);
            break;
        }

        case "Identifier": {
            let funcObjects = newFObjects.getFunctionObjects(functionId);

            if (funcObjects) {
                const typeInfo = funcObjects.get(right.obj.name);

                if (typeInfo) {
                    if (Object.keys(typeInfo).includes("type")) {
                        const typeObj = createType(typeInfo["type"]);
                        newFObjects.addObjectPropertyTypeInfo(functionId, objName, propName, typeObj);
                    }
                } else {
                    newFObjects.addObjectPropertySymbolic(functionId, objName, propName);
                }
            }
            break;
        }

        case "ArrayExpression": {
            const arrayObj = createType("array");
            newFObjects.addObjectPropertyTypeInfo(functionId, objName, propName, arrayObj);
            break;
        }

        case "ObjectExpression": {
            const objectObj = createType("object");
            newFObjects.addObjectPropertyTypeInfo(functionId, objName, propName, objectObj);
            break;
        }


        // case "MemberExpression": {
        //     return handleMemberExpression(stmtId, stmt, leftIdentifier, right, trackers);
        // }

        // case "BinaryExpression": {
        //     return handleBinaryExpression(stmtId, stmt, leftIdentifier, right, trackers);
        // }
    }

    return newFObjects;
};

export function buildTypesFromAssignmentExpression(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();
    const left = getASTNode(node, "left");
    const right = getASTNode(node, "right");

    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;
            return buildTypesFromSimpleAssignment(leftIdentifier, right, graph, functionId, fObjects);
        }

        // object write
        case "MemberExpression": {
            return buildTypesFromObjectWrite(left, right, graph, functionId, fObjects);
        }
    }

    return newFObjects;
};


export function buildTypesFromExpressionStatement(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();

    const expressionNode = getASTNode(node, "expression");
    if (expressionNode) {
        switch (expressionNode.type) {
            case "AssignmentExpression": {
                return buildTypesFromAssignmentExpression(expressionNode, graph, functionId, fObjects);
            }
        }
    }

    return newFObjects;
};

export function buildTypesFromVariableAssignment(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();

    const initNode = getASTNode(node, "init");
    if (initNode) {
        const leftIdentifier: Identifier = node.obj.id;
        return buildTypesFromSimpleAssignment(leftIdentifier, initNode, graph, functionId, fObjects);
    }

    return newFObjects;
};