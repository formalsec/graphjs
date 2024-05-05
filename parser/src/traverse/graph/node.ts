import { type Dependency } from "../dependency/dep_factory";
import { type GraphEdge } from "./edge";

/*
 * This class represents the graph nodes
 */
export class GraphNode {
    private _id: number;
    /* This value can be:
    - [AST, CFG] for starter nodes
    - Type of AST statement, for AST nodes
    - CFG_F_START, CFG_END, CFG_IF_END, CFG_WHILE_END, CFG_TRY_STMT_END, FOR_END, for CFG nodes */
    private _type: string;
    private _obj: any;
    private _edges: GraphEdge[];
    // This value represents the identifier of the node for CFG nodes (Program, ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, LabeledStatement)
    private _identifier: string | null;
    // This value represents the namespace for start/end CFG nodes (__main__, #n_anon) - same as __functionName__
    private _namespace: string | null;
    // This value represents the name of the function for function CFG nodes (ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, LabeledStatement)
    private _functionName: string | null;
    // This value represents the id of the start CFG node for the flow
    private _functionContext: number;
    // This value represents the id of the graph node that contains the function declaration
    private _functionNodeId: number;
    private _internalStructure: any;
    private _used: boolean;
    private _cfgEndNodeId: number;
    private _propertyDependencies: Dependency[]; // stores the dependencies of the tainted properties
    private _arguments: boolean;
    // This value represents additional information for AST nodes: object type for Literal, operator type for BinaryExpression and computation type for MemberExpression
    private _subtype: string;

    private _exported:boolean;

    private _argsObjsIds: number[][];

    constructor(id: number, type: string, obj = {}) {
        this._id = id;
        this._type = type;
        this._obj = obj;
        this._edges = [];
        this._identifier = null;
        this._namespace = null;
        this._functionName = null;
        this._functionContext = 0;
        this._functionNodeId = -1;
        this._internalStructure = null;
        this._used = false;
        this._cfgEndNodeId = -1;
        this._propertyDependencies = [];
        this._arguments = false;
        this._subtype = ""
        this._exported = false;
        this._argsObjsIds = [];
    }

    get argsObjIDs(): number[][] {
        return this._argsObjsIds;
    }

    get id(): number {
        return this._id;
    }

    get type(): string {
        return this._type;
    }

    get obj(): any {
        return this._obj;
    }

    set obj(obj) {
        this._obj = obj;
    }

    get edges(): GraphEdge[] {
        return this._edges;
    }

    set edges(edges:GraphEdge[]) {
        this._edges = edges;
    }

    get identifier(): string | null {
        return this._identifier;
    }

    set identifier(identifierStr) {
        this._identifier = identifierStr;
    }

    get namespace(): string | null {
        return this._namespace;
    }

    set namespace(namespace) {
        this._namespace = namespace;
    }

    get functionName(): string | null {
        return this._functionName;
    }

    set functionName(name) {
        this._functionName = name;
    }

    get functionContext(): number {
        return this._functionContext;
    }

    set functionContext(id) {
        this._functionContext = id;
    }

    get functionNodeId(): number {
        return this._functionNodeId;
    }

    set functionNodeId(id) {
        this._functionNodeId = id;
    }

    get internalStructure(): any {
        return this._internalStructure;
    }

    get exported(): boolean {
        return this._exported;
    }

    set internalStructure(struct) {
        this._internalStructure = struct;
    }

    get used(): boolean {
        return this._used;
    }

    get cfgEndNodeId(): number {
        return this._cfgEndNodeId;
    }

    set cfgEndNodeId(id: number) {
        this._cfgEndNodeId = id;
    }

    get propertyDependencies(): Dependency[] {
        return this._propertyDependencies;
    }

    get arguments(): boolean {
        return this._arguments;
    }

    set arguments(value: boolean) {
        this._arguments = value;
    }

    addPropertyDependencies(dep: Dependency[]): void {
        this._propertyDependencies.push(...dep);
    }

    addArgsObjIds(ids: number[]): void {
        this._argsObjsIds.push(ids);
    }

    

    setUsed(): void {
        this._used = true;
    }

    setExported(): void {
        this._exported = true;
    }

    addEdge(edge: GraphEdge): void {
        this._edges.push(edge);
    }

    get subtype(): string {
        return this._subtype;
    }

    set subtype(value: string) {
        this._subtype = value;
    }

    accept(visitor: any): void {
        visitor.visit(this);
    }
}
