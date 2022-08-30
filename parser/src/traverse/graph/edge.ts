import { GraphNode } from "./node";

export interface EdgeInfo {
    type: string,
    label: string,
    objName: string,
    argumentIndex: number,
    paramIndex: number,
    stmtIndex: number,
    elementIndex: number,
    expressionIndex: number,
    methodIndex: number,
    specifierIndex: number,
    sourceObjName: string,
};

export class GraphEdge {
    private _id: number;
    private _nodes: GraphNode[];
    private _type: string;
    private _label: string;
    private _obj_name: string;
    private _argument_index: number;
    private _param_index: number;
    private _stmt_index: number;
    private _element_index: number;
    private _expression_index: number;
    private _method_index: number;
    private _specifier_index: number;
    private _source_obj_name: string;

    constructor(id: number, node1: GraphNode, node2: GraphNode, edgeInfo: EdgeInfo) {
        this._id = id;
        this._nodes = [node1, node2];
        this._type = edgeInfo.type;

        this._label = edgeInfo.label;
        if (this.label !== "CREATE") {
            node1.setUsed();
            node2.setUsed();
        }

        this._obj_name = edgeInfo.objName || "";
        this._source_obj_name = edgeInfo.sourceObjName || "";
        this._argument_index = edgeInfo.argumentIndex;
        this._param_index = edgeInfo.paramIndex;
        this._stmt_index = edgeInfo.stmtIndex;
        this._element_index = edgeInfo.elementIndex;
        this._expression_index = edgeInfo.expressionIndex;
        this._method_index = edgeInfo.methodIndex;
        this._specifier_index = edgeInfo.specifierIndex;
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

    get elementIndex() {
        return this._element_index;
    }

    get expressionIndex() {
        return this._expression_index;
    }

    get methodIndex() {
        return this._method_index;
    }

    get specifierIndex() {
        return this._specifier_index;
    }

    get sourceObjName() {
        return this._source_obj_name;
    }

    set sourceObjName(name: string) {
        this._source_obj_name = name;
    }
}
