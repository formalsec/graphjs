class Edge {
    constructor(id, node1, node2, edgeInfo) {
        this._id = id;
        this._nodes = [node1, node2];

        this._type = edgeInfo.type;
        this._label = edgeInfo.label;
        this._obj_name = edgeInfo.objName || "";
        this._argument_index = edgeInfo.argumentIndex;
        this._param_index = edgeInfo.paramIndex;
        this._stmt_index = edgeInfo.stmtIndex;
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

    get objName() {
        return this._obj_name;
    }

    get argumentIndex() {
        return this._argument_index;
    }

    get paramIndex() {
        return this._param_index;
    }

    get stmtIndex() {
        return this._stmt_index;
    }
}

module.exports = { Edge };
