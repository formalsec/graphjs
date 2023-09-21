import { type GraphNode } from "./node";

/*
 * This interface represents the information that can be associated with each graph edge
 * EdgeInfo is one of the arguments of GraphEdge constructor
 */
export interface EdgeInfo {
    /* This value can be:
    - AST: edge between AST nodes
    - CFG: edge between CFG nodes
    - FD: edge between the function declaration (AST) and the start of the flow (CFG) */
    type: string
    /* This value can represent:
    - Number of the statement (AST)
    - Type of the statement (AST) */
    label: string
    objName: string
    // This value represents the argument index for AST nodes (CallExpression, NewExpression)
    argumentIndex: number
    // This value represents the parameter index for AST nodes (ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, CatchClause)
    paramIndex: number
    // This value represents the statement index for AST nodes (BlockStatement)
    stmtIndex: number
    // This value represents the element index for AST nodes (ArrayExpression)
    elementIndex: number
    // This value represents the expression index for AST nodes (TemplateLiteral)
    expressionIndex: number
    // This value represents the method index for AST nodes (ClassBody)
    methodIndex: number
    // This value represents the specifier index for AST nodes (ExportNamedDeclaration)
    specifierIndex: number
    sourceObjName: string
    // This value represents if the edge is from the property or object in dependency edges
    // To differentiate the edges of obj[x] = value
    isPropertyDependency: boolean
}

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
    private _isPropertyDependency: boolean;

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
        this._isPropertyDependency = edgeInfo.isPropertyDependency || false;
    }

    get id(): number {
        return this._id;
    }

    get nodes(): GraphNode[] {
        return this._nodes;
    }

    get type(): string {
        return this._type;
    }

    get label(): string {
        return this._label;
    }

    get objName(): string {
        return this._obj_name;
    }

    get argumentIndex(): number {
        return this._argument_index;
    }

    get paramIndex(): number {
        return this._param_index;
    }

    get stmtIndex(): number {
        return this._stmt_index;
    }

    get elementIndex(): number {
        return this._element_index;
    }

    get expressionIndex(): number {
        return this._expression_index;
    }

    get methodIndex(): number {
        return this._method_index;
    }

    get specifierIndex(): number {
        return this._specifier_index;
    }

    get sourceObjName(): string {
        return this._source_obj_name;
    }

    get isPropertyDependency(): boolean {
        return this._isPropertyDependency;
    }

    set isPropertyDependency(value: boolean) {
        this._isPropertyDependency = value;
    }
}
