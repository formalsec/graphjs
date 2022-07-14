import { GraphNode } from "./node";

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

    constructor(id: number, node1: GraphNode, node2: GraphNode, edgeInfo: any) {
        this._id = id;
        this._nodes = [node1, node2];
        this._type = edgeInfo.type;

        this._label = edgeInfo.label;
        if (this.label !== "CREATE") {
            node1.setUsed();
            node2.setUsed();
        }

        this._obj_name = edgeInfo.objName || "";
        this._argument_index = edgeInfo.argumentIndex;
        this._param_index = edgeInfo.paramIndex;
        this._stmt_index = edgeInfo.stmtIndex;
        this._element_index = edgeInfo.elementIndex;
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
}
