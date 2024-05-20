import { DependencyTracker } from "../traverse/dependency/structures/dependency_trackers";
import { GraphNode } from "../traverse/graph/node";
import { Graph } from "../traverse/graph/graph";
import fs from "fs";

// looks in the function contexts for a function with the given name
// Only used to find the exported functions
function findFuncNode(targetName:any,trackers:DependencyTracker):GraphNode|undefined{

    let result = trackers.declaredFuncsMap.get(targetName);
    if(result)
        trackers.graphGetNode(result.id)?.setExported();
    return result;
}

// given a node, construct the object encapsulated by it, so that it can be used to construct the exported object
function constructObject(node:GraphNode,trackers:DependencyTracker,cpg:Graph,identifier:string=""):GraphNode|any{
    let exportedObject:any = {};
    if(node.type == "ObjectExpression"){
        // is an object so recursively construct its properties
        node.properties.forEach((property:any) => {
            // the only nodes that interest us are the ones that are either functions or objects
            // functions -> we can call them (thus can export sinks)
            // objects -> we can access their properties (thus can export sinks)
            let func = findFuncNode(property.value.name,trackers);
            if(func != undefined)
                exportedObject[property.key.name] = findFuncNode(property.value.name,trackers);
            else{
                // not a function (not in function context) so it might be an object, thus look for its declaration
                // to check it
                let objProp = findDeclaration(property.value.name,trackers,cpg);
                
        
                if(objProp != undefined){
                    let init = objProp.obj.init;
                    if(init == undefined){
                        let variable = trackers.variablesMap.get(objProp.identifier ?? "");
                        init = findDeclaration(variable,trackers,cpg)?.obj.init;
                    }
                    if(init)
                        exportedObject[property.key.name] = constructObject(init,trackers,cpg,property.value.name);
                }
            }
        });

        // some properties might be assigned to the object after its declaration
        findOtherProperties(identifier,trackers,cpg).forEach((newProp,propName) => {
            let newPropObj = findDeclaration(newProp,trackers,cpg);
            if(newPropObj != undefined){
                let init = newPropObj.obj.init;

                if(init == undefined){
                    let variable = trackers.variablesMap.get(newPropObj.identifier ?? "");
                    init = findDeclaration(variable,trackers,cpg)?.obj.init;
                }
                if(init)
                    exportedObject[propName] = constructObject(init,trackers,cpg,newProp);
            }
        });
    
        return exportedObject;
    }
    else if(node.type == "FunctionExpression"){
        // is a function, just return its cpg (by returning the head of the graph)
        return findFuncNode(identifier,trackers);
    }

    return {};
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
            let init = result.obj.init;

            if(init == undefined){
                let variable = trackers.variablesMap.get(result.identifier ?? "");
                init = findDeclaration(variable,trackers,cpg)?.obj.init;
            }
            if(init)
                exportedObject = constructObject(init,trackers,cpg,result.identifier ?? "");
        }

    }

    // assignments to the properties of module.exports
    trackers.moduleExportsAssignmentsMap.forEach((node:GraphNode,prop:string) => {
        let result = findDeclaration(node.identifier,trackers,cpg);
        
        if(result != undefined){
            let init = result.obj.init;

            if(init == undefined){
                let variable = trackers.variablesMap.get(result.identifier ?? "");
                init = findDeclaration(variable,trackers,cpg)?.obj.init;
            }

            if(init)
                exportedObject[prop] = constructObject(init,trackers,cpg,node.identifier ?? "");
        }


    });

    // assignments to the properties of exports
    trackers.exportsAssignmentsMap.forEach((node:GraphNode,prop:string) => {
        let result = findDeclaration(node.identifier,trackers,cpg);
        
        if(result != undefined){

            let init = result.obj.init;

            if(init == undefined){
                let variable = trackers.variablesMap.get(result.identifier ?? "");
                init = findDeclaration(variable,trackers,cpg)?.obj.init;
            }
            
            if(init)
                exportedObject[prop] = constructObject(init,trackers,cpg,node.identifier ?? "");
        }
    });



    return exportedObject;

}

// find the corresponding file for the given targetName, even if we're calling a subobject of a module
export function findCorrespodingFile(targetName:string,context:number,trackers:DependencyTracker):[string,Array<string>]{
    let module = undefined;
    let propertiesToTraverse =[]

    do {
        let contexts = trackers.getPossibleObjectContexts(targetName,context);
        for(let context of contexts){
            module = trackers.variablesMap.get(context);
            if(module){
                module =  module.startsWith("./") ? module.substring(2) : module;
                // if we're dealing with a subObject with need to find the parent object 
                // holds the module (thus we iterate again)
                let split = module.split("."); 
                if(split.length > 2){
                    targetName = split[0];
                    propertiesToTraverse.push(...split.slice(1));
                }
                else
                    targetName = "";
                break;
            }
        }
    } while (module != undefined && !module.endsWith(".js") && targetName != "");


    return [module,propertiesToTraverse];

}

// Function to print dependency graph to file
export function printDependencyGraph(tree:any, filename:string) {

    
    // Helper function to recursively build adjacency list
    const adjacencyList:any = {};
    function buildAdjacencyList(node:any, parent:any) {
        for (const file in node) {
            if (!adjacencyList[file]) {
                adjacencyList[file] = [];
            }
            if (parent) {
                adjacencyList[parent].push(file);
            }
            buildAdjacencyList(node[file], file);
        }
    }

   
    buildAdjacencyList(tree,null);

    let output = '';
    for (const file in adjacencyList) {
        const dependencies = adjacencyList[file];
        if (dependencies.length > 0) {
            output += `${file}:\n\n\t${dependencies.join('\n\t')}\n\n`;
        } else {
            output += `${file}:\n\n\tNo dependencies\n\n`;
        }
    }

    fs.writeFileSync(filename, output);

}

// retrieve the graph node that corresponds to the exported object (may need to traverse properties)
export function retrieveFunctionGraph(exportedObject:any,propertiesToTraverse:string[]):GraphNode|undefined{
    let result = exportedObject;
    if(result instanceof GraphNode)
        return result;

    for(let property of propertiesToTraverse){
        result = result[property];
    }

    return result instanceof GraphNode ? result : undefined;

}
