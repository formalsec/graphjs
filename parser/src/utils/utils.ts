import { GraphEdge } from "../traverse/graph/edge";
import { GraphNode } from "../traverse/graph/node";

/* eslint-disable no-plusplus */
let VAR_COUNT = 1;
let NODE_COUNT = 1;
let OBJ_COUNT = 1;

export function copyObj(obj: any): any {
    const newObj = JSON.parse(JSON.stringify(obj));
    return newObj;
}

export const getNextNodeId = () => NODE_COUNT++;

export const resetNodeId = () => NODE_COUNT = 1;

export const getNextVariableName = () => `v${VAR_COUNT++}`;

export const resetVariableCount = () => VAR_COUNT = 1;

export const getNextObjectName = () => `o${OBJ_COUNT++}`;

export const resetObjectCount = () => OBJ_COUNT = 1;

export const printJSON = (json: any) => console.log(JSON.stringify(json, null, 2));

export function clone<T>(a: T): T {
    return JSON.parse(JSON.stringify(a));
}

export function getASTNode(parent: GraphNode, childLabel: string): GraphNode {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel)[0]?.nodes[1];
}

export function getASTChildren(parent: GraphNode): GraphNode[] {
    return parent.edges.filter(e => e.type === "AST").map(e => e.nodes[1]);
}

export function getAllASTNodes(parent: GraphNode, childLabel: string): GraphNode[] {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel).map(e => e.nodes[1]);
}

export function getAllASTEdges(parent: GraphNode, childLabel: string): GraphEdge[] {
    return parent.edges.filter(e => e.type === "AST" && e.label === childLabel);
}