import { type Identifier } from "estree";
import { type Store } from "../traverse/dependency/structures/dependency_trackers";
import { type GraphEdge } from "../traverse/graph/edge";
import { type GraphNode } from "../traverse/graph/node";

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
