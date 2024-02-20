import { type Identifier } from "estree";
import { type Store,DependencyTracker } from "../traverse/dependency/structures/dependency_trackers";
import { type GraphEdge } from "../traverse/graph/edge";
import { type GraphNode } from "../traverse/graph/node";
import { Graph } from "../traverse/graph/graph";

let VAR_COUNT = 1;
let NODE_COUNT = 1;
let OBJ_COUNT = 1;

function replacer(key: any, value: any): object {
    if (value instanceof Map) {
        return { dataType: 'Map', value: [...value] };
    } else { return value; }
}

function reviver(key: any, value: any): object {
    if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
        return new Map(value.value);
    }
    return value;
}

export function copyObj(obj: any): any {
    return JSON.parse(JSON.stringify(obj, replacer), reviver);
}

export const getNextNodeId = (): number => NODE_COUNT++;

export const resetNodeId = (): number => { NODE_COUNT = 1; return NODE_COUNT }

export const getNextVariableName = (): string => `v${VAR_COUNT++}`;

export const resetVariableCount = (): number => { VAR_COUNT = 1; return VAR_COUNT };

export interface ContextNames {
    pdgObjName: string
    pdgObjNameContext: string
}

export const getNextLocationName = (variableName: string, context: number): string => {
    const objectNumber: number = OBJ_COUNT++;
    return `${context}.${variableName}-o${objectNumber}`;

};

export const resetObjectCount = (): number => { OBJ_COUNT = 1; return OBJ_COUNT };

export const printStatus = (step: string): void => { console.log(`Step - ${step} - concluded.`); }

export function clone<T>(a: T): T {
    return JSON.parse(JSON.stringify(a));
}

export function getASTNode(parent: GraphNode, childLabel: string): GraphNode {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel)[0]?.nodes[1];
}

export function getFDNode(parent: GraphNode): GraphNode {
    return parent.edges.filter(e => e.type === "FD")[0]?.nodes[1];
}

export function getAllASTNodes(parent: GraphNode, childLabel: string): GraphNode[] {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel).map(e => e.nodes[1]);
}

export function getAllASTEdges(parent: GraphNode, childLabel: string): GraphEdge[] {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel);
}

export function createThisExpression(): Identifier {
    return {
        type: "Identifier",
        name: "this"
    };
}

export function deepCopyStore(s: Store): Store {
    const storeCloned: Store = new Map();

    s.forEach((values: number[], key: string) => {
        storeCloned.set(key, clone(values));
    });

    return storeCloned;
}

// looks in the function contexts for a function with the given name
function findFuncNode(targetName:any,trackers:DependencyTracker,cpg:Graph):GraphNode|undefined{

    return trackers.declaredFuncsMap.get(targetName);
}

// given a node, construct the object encapsulated by it, so that it can be used to construct the exported object
function constructObject(node:GraphNode,trackers:DependencyTracker,cpg:Graph,identifier:string=""):GraphNode|undefined{
    let exportedObject:any = {};
    if(node.type == "ObjectExpression"){
        // is an object so recursively construct its properties
        node.properties.forEach((property:any) => {
            // the only nodes that interest us are the ones that are either functions or objects
            // functions -> we can call them (thus can export sinks)
            // objects -> we can access their properties (thus can export sinks)
            let func = findFuncNode(property.value.name,trackers,cpg);
            if(func != undefined)
                exportedObject[property.key.name] = findFuncNode(property.value.name,trackers,cpg);
            else{
                // not a function (not in function context) so it might be an object, thus look for its declaration
                // to check it
                let objProp = findDeclaration(property.value.name,trackers,cpg);
        
                if(objProp != undefined){
                    exportedObject[property.key.name] = constructObject(objProp.obj.init,trackers,cpg,property.value.name);
                }
            }
        });

        // some properties might be assigned to the object after its declaration
        findOtherProperties(identifier,trackers,cpg).forEach((newProp,propName) => {
            let newPropObj = findDeclaration(newProp,trackers,cpg);
            if(newPropObj != undefined)
                exportedObject[propName] = constructObject(newPropObj.obj.init,trackers,cpg,newProp);
        });
    
        return exportedObject;
    }
    else if(node.type == "FunctionExpression"){
        // is a function, just return its cpg (by returning the head of the graph)
        return findFuncNode(identifier,trackers,cpg);
    }
}

// given the name of a variable, look for node that holds its declaration
function findDeclaration(name:any,trackers:DependencyTracker,cpg:Graph):GraphNode|undefined{
    let result = undefined;

    // look for object/function declaration (assignmentsMap also has the init of declarations)
    trackers.assignmentsMap.forEach((_,key) => {
        let node = cpg.nodes.get(key);
        if(node != undefined && node.type == "VariableDeclarator" &&
        node.identifier == name){
            result = node;
            return;
        }

    });


    return result 
}

// look for assignments that create new properties on objects (auxilary function to constructObject) 
function findOtherProperties(name:any,trackers:DependencyTracker,cpg:Graph):Map<string,string> {
    let result:Map<string,string> = new Map();

    // look for object/function declaration (assignmentsMap also has the init of declarations)
    trackers.assignmentsMap.forEach((_,key) => {
        let node = cpg.nodes.get(key);
        if(node != undefined && node.type == "ExpressionStatement" &&
        node.obj.expression.type == "AssignmentExpression" && 
        node.obj.expression.left.type == "MemberExpression" &&
        node.obj.expression.left.object.name == name){
            result.set(node.obj.expression.left.property.name,node.obj.expression.right.name);
        }

    });


    return result; 
}

// constructs the object that would be retrieved if require is called on the given file
export function constructExportedObject(cpg:Graph,trackers:DependencyTracker){

    let exportedObject:any = {};

    // module.exports is assigned to a variable
    if(trackers.moduleExportsIdentifier != ""){
        let result = findDeclaration(trackers.moduleExportsIdentifier,trackers,cpg);
        
        if(result != undefined){
            exportedObject = constructObject(result.obj.init,trackers,cpg,result.identifier);
        }

    }

    // assignments to the properties of module.exports
    trackers.moduleExportsAssignmentsMap.forEach((node:GraphNode,prop:string) => {
        let result = findDeclaration(node.identifier,trackers,cpg);
        
        if(result != undefined){
            exportedObject[prop] = constructObject(result.obj.init,trackers,cpg,node.identifier);
        }


    });

    // assignments to the properties of exports
    trackers.exportsAssignmentsMap.forEach((node:GraphNode,prop:string) => {
        let result = findDeclaration(node.identifier,trackers,cpg);
        
        if(result != undefined){
            exportedObject[prop] = constructObject(result.obj.init,trackers,cpg,node.identifier);
        }
    });



    return exportedObject;

}
    

export function findCorrespodingFile(name:string,context:number,trackers:DependencyTracker){
    let contexts = trackers.getPossibleObjectContexts(name,context);

    for(let context of contexts){
        let module = trackers.variablesMap.get(context);
        if(module) return module.startsWith("./") ? module.substring(2) : module;
    }
}
