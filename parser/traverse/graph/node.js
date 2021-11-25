class Node {
    constructor(id, type, obj = {}) {
        this._id = id;
        this._type = type;
        this._obj = obj;
        this._edges = [];
        this.identifier = null;
        this._namespace = null;
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

    addEdge(edge) {
        this._edges.push(edge);
    }

    accept(visitor) {
        visitor.visit(this);
    }
}

module.exports = { Node };
