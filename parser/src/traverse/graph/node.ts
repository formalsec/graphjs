import { GraphEdge } from "./edge";

export class GraphNode {
    private _id: number;
    private _type: string;
    private _obj: any;
    private _edges: GraphEdge[];
    private _identifier: string | null;
    private _namespace: string | null;
    private _variableName: string | null;
    private _functionName: string | null;
    private _functionContext: number;
    private _functionNodeId: number;
    private _internalStructure: any;
    private _used: boolean;

    constructor(id: number, type: string, obj = {}) {
        this._id = id;
        this._type = type;
        this._obj = obj;
        this._edges = [];
        this._identifier = null;
        this._namespace = null;
        this._variableName = null;
        this._functionName = null;
        this._functionContext = 0;
        this._functionNodeId = -1;
        this._internalStructure = null;
        this._used = false;
    }

    get id() {
        return this._id;
    }

    get type() {
        return this._type;
    }

    get obj() {
        return this._obj;
    }

    set obj(obj) {
        this._obj = obj;
    }

    get edges() {
        return this._edges;
    }

    get identifier() {
        return this._identifier;
    }

    set identifier(identifierStr) {
        this._identifier = identifierStr;
    }

    get namespace() {
        return this._namespace;
    }

    set namespace(namespace) {
        this._namespace = namespace;
    }

    get variableName() {
        return this._variableName;
    }

    set variableName(variableName) {
        this._variableName = variableName;
    }

    get functionName() {
        return this._functionName;
    }

    set functionName(name) {
        this._functionName = name;
    }

    get functionContext() {
        return this._functionContext;
    }

    set functionContext(id) {
        this._functionContext = id;
    }

    get functionNodeId() {
        return this._functionNodeId;
    }

    set functionNodeId(id) {
        this._functionNodeId = id;
    }

    get internalStructure() {
        return this._internalStructure;
    }

    set internalStructure(struct) {
        this._internalStructure = struct;
    }

    get used() {
        return this._used;
    }

    setUsed() {
        this._used = true;
    }

    addEdge(edge: GraphEdge) {
        this._edges.push(edge);
    }

    accept(visitor: any) {
        visitor.visit(this);
    }
}
