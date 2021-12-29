import { GraphEdge } from "./edge";

export class GraphNode {
    private _id: number;
    private _type: string;
    private _obj: any;
    private _edges: GraphEdge[];
    private _identifier: string | null;
    private _namespace: string | null;
    private _variableName: string | null;

    constructor(id: number, type: string, obj = {}) {
        this._id = id;
        this._type = type;
        this._obj = obj;
        this._edges = [];
        this._identifier = null;
        this._namespace = null;
        this._variableName = null;
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

    addEdge(edge: GraphEdge) {
        this._edges.push(edge);
    }

    accept(visitor: any) {
        visitor.visit(this);
    }
}
