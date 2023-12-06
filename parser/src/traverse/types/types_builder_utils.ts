import { Identifier } from "estree";
import { getAllASTNodes, getASTNode } from "../../utils/utils";
import { DependencyTracker } from "../dependency/structures/dependency_trackers";
import * as DependencyFactory from "../dependency/dep_factory";
import { StorageFactory, StorageObject } from "../dependency/sto_factory";
import { Graph } from "../graph/graph";
import { GraphNode } from "../graph/node";

export type FObjects = Map<string, Map<string, any>>;

export class FunctionObjects {
    private _fObjects: FObjects;

    constructor() {
        this._fObjects = new Map();
    }

    addParam(functionId: number, functionContext: number, paramName: string) {
        let paramObj = this._fObjects.get(functionId.toString());
        if (!paramObj) {
            paramObj = new Map();
        }

        paramObj.set(paramName, createType(functionContext, "symbolic"));

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

    addVariableSymbolic(functionId: number, functionContext: number, variableName: string) {
        let functionVariables = this._fObjects.get(functionId.toString());

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let varType = createType(functionContext, "symbolic");

        functionVariables?.set(variableName, varType);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addObjectPropertyTypeInfo(functionId: number, obj: GraphNode, propName: string, typeInfo: any) {
        let functionVariables = this._fObjects.get(functionId.toString());
        const objName = obj.obj.name;

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let objType: any = createType(obj.functionContext, "object");

        if (functionVariables?.has(objName)) {
            const localObjType = functionVariables.get(objName);

            if (localObjType.type == "object") {
                objType = localObjType;
            }
            objType["properties"][propName] = typeInfo;
        }

        functionVariables?.set(objName, objType);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addNewObjectPropertySymbolic(functionId: number, obj: GraphNode, propName: string) {
        let functionVariables = this._fObjects.get(functionId.toString());
        const objName = obj.obj.name;

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let objType: any = createType(obj.functionContext, "object");
        objType["properties"][propName] = createType(obj.functionContext, "symbolic");

        functionVariables?.set(objName, objType);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addObjectPropertySymbolic(functionId: number, obj: GraphNode, propName: string) {
        let functionVariables = this._fObjects.get(functionId.toString());
        const objName = obj.obj.name;

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let objType: any = createType(obj.functionContext, "object");

        if (functionVariables?.has(objName)) {
            objType = functionVariables.get(objName);
            objType["properties"][propName] = createType(obj.functionContext, "symbolic");
        }

        functionVariables?.set(objName, objType);
        this._fObjects.set(functionId.toString(), functionVariables);
    }

    addReferencedObjectPropertyTypeInfo(functionId: number, functionContext: number, locationSplit: string[], newPropName: string, typeInfo: any) {
        // if there are no references
        if (locationSplit.length == 0) return;

        let functionVariables = this._fObjects.get(functionId.toString());
        const objName = locationSplit[0];
        const properties = locationSplit.slice(1);

        if (!functionVariables) {
            functionVariables = new Map();
        }

        let objType: any = createType(functionContext, "object");

        if (functionVariables?.has(objName)) {
            objType = functionVariables.get(objName);
            let props = objType["properties"];
            const lastPName = properties[properties.length - 1];
            for (let pName of properties) {
                if (Object.keys(props).includes(pName)) {
                    // this is the property path we need to follow
                    const pType = props[pName];
                    if (pName == lastPName) {
                        if (pType["type"] == "object") {
                            pType["properties"][pName] = typeInfo;
                        } else {
                            // need to change it to object
                            const newPType = createType(functionContext, "object");
                            newPType["properties"][newPropName] = typeInfo;
                            props[pName] = newPType;
                        }
                    } else {
                        if (pType["type"] == "object") {
                            props = pType["properties"];
                        } else {
                            throw Error("This should be object");
                        }
                    }
                }
            }

            functionVariables?.set(objName, objType);
        }

        this._fObjects.set(functionId.toString(), functionVariables);

        // if (!functionVariables) {
        //     functionVariables = new Map();
        // }

        // let objType: any = createType(obj.functionContext, "object");

        // if (functionVariables?.has(objName)) {
        //     objType = functionVariables.get(objName);
        //     objType["properties"][propName] = typeInfo;
        // }

        // functionVariables?.set(objName, objType);
        // this._fObjects.set(functionId.toString(), functionVariables);
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

function createType(functionContext: number, type: string, prop_type: string = "prop_string"): any {
    switch(type) {
        case "object": {
            return {
                "type": "object",
                "properties": {},
                "context": functionContext,
            };
        }

        case "array": {
            return {
                "type": "array",
                "prop_type": prop_type,
                "context": functionContext,
            };
        }

        default: {
            return {
                "type": type,
                "context": functionContext,
            };
        }
    }
}

export function buildTypesFromSimpleAssignment(left: Identifier, right: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects, trackers: DependencyTracker): FunctionObjects {
    const newFObjects = fObjects.clone();
    const funcObjects = newFObjects.getFunctionObjects(functionId);
    if (!funcObjects) return newFObjects;

    switch (right.type) {
        case "Literal": {
            let typeInfo = typeof right.obj.value;
            const typeObj = createType(right.functionContext, typeInfo);
            newFObjects.addVariableTypeInfo(functionId, left.name, typeObj);
            break;
        }

        case "Identifier": {
            const typeInfo = funcObjects.get(right.obj.name);

            if (typeInfo) {
                // copy type
                newFObjects.addVariableTypeInfo(functionId, left.name, typeInfo);
            } else {
                newFObjects.addVariableSymbolic(functionId, right.functionContext, left.name);
            }
            break;
        }

        case "ArrayExpression": {
            let arrayObj = createType(right.functionContext, "array");
            const elements = getAllASTNodes(right, "element");
            if (elements.length > 0) {
                const elementType = typeof elements[0].obj.value
                arrayObj = createType(right.functionContext, "array", elementType);
            }
            newFObjects.addVariableTypeInfo(functionId, left.name, arrayObj);
            break;
        }

        case "ObjectExpression": {
            const objectObj = createType(right.functionContext, "object");
            newFObjects.addVariableTypeInfo(functionId, left.name, objectObj);
            break;
        }

        case "MemberExpression": {
            // get child nodes for the member expression
            const obj = getASTNode(right, "object");
            const prop = getASTNode(right, "property");
            const objName = obj.obj.name;
            let propName = prop.obj.name;

            let objStorage = trackers.getStorage(`${right.functionContext}.${objName}`)?.at(0);
            let locationSplit: string[] = [];
            if (objStorage && StorageFactory.isStorageObject(objStorage)) {
                locationSplit = (<StorageObject>objStorage).location.split('.').slice(1).map(s => s.split('-')[0]);
            }

            const computed = right.obj.computed;
            let typeInfo = createType(right.functionContext, "symbolic");

            const varStructure = funcObjects.get(objName);
            if (varStructure) {
                if (varStructure["type"] == "object") {
                    // for objects we have to get its properties
                    const properties = varStructure["properties"];
                    if (propName in properties) {
                        typeInfo = properties[propName];
                    } else {
                        fObjects.addObjectPropertySymbolic(functionId, obj, propName);
                    }

                } else if (varStructure["type"] == "array"){
                    // obj structure is array, we need prop_type
                    typeInfo = varStructure["prop_type"];

                } else {
                    // obj structure is symbolic, we need to change it to object
                    const objTypeInfo = createType(obj.functionContext, "object");
                    fObjects.addVariableTypeInfo(functionId, objName, objTypeInfo);

                    if (computed) {
                        propName = "*";
                        const propTypeInfo = createType(right.functionContext, "prop_string");
                        fObjects.addObjectPropertyTypeInfo(functionId, obj, propName, propTypeInfo);
                    } else {
                        fObjects.addNewObjectPropertySymbolic(functionId, obj, propName);
                    }
                }

                fObjects.addVariableTypeInfo(functionId, left.name, typeInfo);
                fObjects.addReferencedObjectPropertyTypeInfo(functionId, right.functionContext, locationSplit, propName, typeInfo);

            } else {
                fObjects.addVariableSymbolic(functionId, right.functionContext, left.name);
            }
            break;
        }

        case "CallExpression": {
            newFObjects.addVariableSymbolic(functionId, right.functionContext, left.name);
            break;
        }

        case "BinaryExpression": {
            const leftVar = getASTNode(right, "left");
            const rightVar = getASTNode(right, "right");
            break;
        }
    }

    return newFObjects;
};

export function buildTypesFromObjectWrite(left: GraphNode, right: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects): FunctionObjects {
    const newFObjects = fObjects.clone();

    // get child nodes for the member expression
    const obj = getASTNode(left, "object");
    const prop = getASTNode(left, "property");
    const objName: string = obj.obj.name;
    const propName: string = prop.obj.name;

    switch (right.type) {
        case "Literal": {
            let typeInfo = typeof right.obj.value;
            const typeObj = createType(right.functionContext, typeInfo);
            newFObjects.addObjectPropertyTypeInfo(functionId, obj, propName, typeObj);
            break;
        }

        case "Identifier": {
            let funcObjects = newFObjects.getFunctionObjects(functionId);

            if (funcObjects) {
                const typeInfo = funcObjects.get(right.obj.name);

                if (typeInfo) {
                    if (Object.keys(typeInfo).includes("type")) {
                        const typeObj = createType(right.functionContext, typeInfo["type"]);
                        newFObjects.addObjectPropertyTypeInfo(functionId, obj, propName, typeObj);
                    }
                } else {
                    newFObjects.addNewObjectPropertySymbolic(functionId, obj, propName);
                }
            }
            break;
        }

        case "ArrayExpression": {
            const arrayObj = createType(right.functionContext, "array");
            newFObjects.addObjectPropertyTypeInfo(functionId, obj, propName, arrayObj);
            break;
        }

        case "ObjectExpression": {
            const objectObj = createType(right.functionContext, "object");
            newFObjects.addObjectPropertyTypeInfo(functionId, obj, propName, objectObj);
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

export function buildTypesFromAssignmentExpression(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects, trackers: DependencyTracker): FunctionObjects {
    const newFObjects = fObjects.clone();
    const left = getASTNode(node, "left");
    const right = getASTNode(node, "right");

    switch (left.type) {
        // simple assignment / lookup
        case "Identifier": {
            const leftIdentifier: Identifier = left.obj.id ? left.obj.id : left.obj;
            return buildTypesFromSimpleAssignment(leftIdentifier, right, graph, functionId, fObjects, trackers);
        }

        // object write
        case "MemberExpression": {
            return buildTypesFromObjectWrite(left, right, graph, functionId, fObjects);
        }
    }

    return newFObjects;
};


export function buildTypesFromExpressionStatement(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects, trackers: DependencyTracker): FunctionObjects {
    const newFObjects = fObjects.clone();

    const expressionNode = getASTNode(node, "expression");
    if (expressionNode) {
        switch (expressionNode.type) {
            case "AssignmentExpression": {
                return buildTypesFromAssignmentExpression(expressionNode, graph, functionId, fObjects, trackers);
            }
        }
    }

    return newFObjects;
};

export function buildTypesFromVariableAssignment(node: GraphNode, graph: Graph, functionId: number, fObjects: FunctionObjects, trackers: DependencyTracker): FunctionObjects {
    const newFObjects = fObjects.clone();

    const initNode = getASTNode(node, "init");
    if (initNode) {
        const leftIdentifier: Identifier = node.obj.id;
        return buildTypesFromSimpleAssignment(leftIdentifier, initNode, graph, functionId, fObjects, trackers);
    }

    return newFObjects;
};