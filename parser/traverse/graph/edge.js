class Edge {
    constructor(id, node1, node2, edgeInfo) {
        this._id = id;
        this._nodes = [node1, node2];

        this._type = edgeInfo.type;
        this._label = edgeInfo.label;
        this._obj_name = edgeInfo.obj_name || "";
        this._argument_index = edgeInfo.argument_index;
        this._param_index = edgeInfo.param_index;
        this._stmt_index = edgeInfo.stmt_index;
    }

    get id() {
        return this._id;
    }

    get nodes() {
        return this._nodes;
    }

    get type() {
        return this._type;
    }

    get label() {
        return this._label;
    }

    get obj_name() {
        return this._obj_name;
    }

    get argument_index() {
        return this._argument_index;
    }

    get param_index() {
        return this._param_index;
    }

    get stmt_index() {
        return this._stmt_index;
    }
}

module.exports = { Edge };
