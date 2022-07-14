import { getNextVariableName, copyObj, printJSON } from "../utils/utils";

import type {
    Node,
    Program,
    Identifier,
    VariableDeclaration,
    VariableDeclarator,
    BinaryExpression,
    Expression,
    AssignmentExpression,
    MemberExpression,
    LogicalExpression,
    ExpressionStatement,
    Property,
    ArrayExpression,
    ObjectExpression,
    UpdateExpression,
    UnaryExpression,
    CallExpression,
    FunctionDeclaration,
    ArrowFunctionExpression,
    FunctionExpression,
    ClassExpression,
    ClassBody,
    MethodDefinition,
    AwaitExpression,
    YieldExpression,
    SpreadElement,
    SequenceExpression,
    SimpleLiteral,
    BlockStatement,
    Statement, LabeledStatement, IfStatement, TemplateLiteral, TaggedTemplateExpression,
} from "estree";

export interface Normalization {
    stmts: Node[],
    expr: Node | null,
};

export function createRandomIdentifier(): Identifier {
    const variableName = getNextVariableName();
    return {
        type: "Identifier",
        name: variableName,
    };
}

export function createIdentifierWithName(name: string): Identifier {
    return {
        type: "Identifier",
        name,
    };
};

export function createIdentifierFromExpression(expr: Expression): Identifier | null {
    switch(expr.type) {
        case "Identifier": {
            return expr;
        }

        case "Literal": {
            return createIdentifierWithName(expr?.value as string);
        }

    }

    return null;
}

export function createEmptyObject(): ObjectExpression {
    return {
        type: "ObjectExpression",
        properties: [],
    };
};

export function createBooleanLiteral(value: boolean): SimpleLiteral {
    return {
        type: "Literal",
        value,
        raw: value?.toString()
    };
}

interface CreatedDeclaration {
    id: Identifier,
    decl: VariableDeclaration,
};

interface CreatedDeclarator {
    id: Identifier,
    decl: VariableDeclarator,
};

export function createVariableDeclaration(obj: Expression | null | undefined, objId?: string, constant: boolean = true): CreatedDeclaration {
    const id = (objId)? createIdentifierWithName(objId) : createRandomIdentifier();

    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id,
                init: obj,
            },
        ],
        kind: (constant)? "const" : "let",
    };

    return { id, decl };
};

export function createVariableDeclarationWithIdentifier(identifier: Identifier, obj: Expression | null | undefined): CreatedDeclaration {
    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: identifier,
                init: obj,
            },
        ],
        kind: "const",
    };

    return { id: identifier, decl };
};

export function createVariableDeclarator(newInit: Expression | null | undefined): CreatedDeclarator {
    const id = createRandomIdentifier();

    const decl: VariableDeclarator = {
        type: "VariableDeclarator",
        id,
        init: newInit,
    };

    return { id, decl };
};

export function createObjectLookupDeclarator(prop: Property, objectValue: Expression): VariableDeclarator {
    const propValue = prop.value as Expression;
    const propKey = prop.key as Identifier;
    const memExpr: MemberExpression = {
        type: "MemberExpression",
        computed: false,
        optional: false,
        object: objectValue,
        property: propValue,
    };

    return {
        type: "VariableDeclarator",
        id: propKey,
        init: memExpr,
    };
};

export function createPropertyAssignment(objId: Identifier, propKey: Identifier, propValue: Expression): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: {
                type: "MemberExpression",
                computed: false,
                object: objId,
                property: propKey,
                optional: false,
            },
            right: propValue,
        },
    };
};

export function createExpressionAssignment(objId: string, objValue: Expression): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: {
                type: "Identifier",
                name: objId,
            },
            right: objValue,
        },
    };
};

export function unpattern(declarations: VariableDeclarator[]): VariableDeclarator[] {
    const unpatternedDeclarations: VariableDeclarator[] = [];

    declarations.forEach((d) => {
        if (d.id.type === "ObjectPattern") {
            const originalInit = d.init;
            const { id, decl } = createVariableDeclarator(originalInit);

            // push a new variable with the member expression
            unpatternedDeclarations.push(decl);

            // push declarations for each property using accesses to new variable
            d.id.properties.forEach((prop) => {
                if (prop.type === "Property")
                    unpatternedDeclarations.push(createObjectLookupDeclarator(prop as Property, id));
            });
        } else {
            unpatternedDeclarations.push(d);
        }
    });

    return unpatternedDeclarations;
};

export const flatStmts = (children: Normalization[]): Node[] => children.map((child) => child.stmts).flat();
export const flatExprs = (children: Normalization[]): (Node | null)[] => children.map((child) => child.expr).flat();
export const isNotPropertyMethod = (obj: Node): boolean => obj.type !== "Property";
export const isNotLiteral = (obj: Node): boolean => obj.type !== "Literal" && obj.type !== "Identifier";
export function isNotEmpty (obj: Node): boolean {
    if (obj.type === "ArrayExpression") {
        return obj.elements.length > 0;
    }
    return true;
};

export function normProgram(obj: Program, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.body = flatStmts(children);
    return { stmts: [newObj], expr: null };
};

export function normBinaryExpression(obj: BinaryExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const leftExpr = children[0].expr;
    const rightExpr = children[1].expr;

    // if both left and right expression were not normalized we just ignore
    if (leftExpr && rightExpr) {
        newObj.left = children[0].expr;
        newObj.right = children[1].expr;

        const { id, decl } = createVariableDeclaration(newObj);

        return {
            stmts: [...children[0].stmts, ...children[1].stmts, decl],
            expr: id,
        };
    }

    return { stmts: [], expr: newObj };
};

export function normLogicalExpression(obj: LogicalExpression, children: Normalization[], parent: Node | null): Normalization {
    const leftExpr: Expression = children[0].expr as Expression;
    let newStmts: Node[] = []

    let ifConditionId: Identifier;
    // If left expression is already an identifier (already normalized)
    if (leftExpr && leftExpr.type === "Identifier") {
        ifConditionId = leftExpr;
        newStmts.push(...children[0].stmts)
        // If left expression is a literal
    } else if (leftExpr && leftExpr.type === "Literal") {
        const {id, decl} = createVariableDeclaration(leftExpr);
        ifConditionId = id;
        newStmts.push(decl)
    } else return { stmts: [...children[0].stmts, ...children[1].stmts], expr: obj };

    // Create the variable to return the result
    const { id, decl } = createVariableDeclaration(undefined, undefined, false);
    newStmts.push(decl)

    // Consequent Block (right normalization + update result variable)
    let newResult = createExpressionAssignment(id.name, children[1].expr as Expression);
    const newConsequentBlock: BlockStatement = { type: "BlockStatement", body: [...children[1].stmts as Statement[], newResult] }

    // Alternate Block (update result variable)
    newResult = createExpressionAssignment(id.name, ifConditionId);
    const newAlternateBlock: BlockStatement = { type: "BlockStatement", body: [newResult] }

    const newObj: IfStatement = { type: "IfStatement", test: ifConditionId, consequent: newConsequentBlock, alternate: newAlternateBlock }
    newStmts.push(newObj)

    return { stmts: newStmts, expr: (parent?.type == "ExpressionStatement")? null : id };
};

export function normVariableDeclaration(obj: VariableDeclaration, children: Normalization[]): Normalization {
    let stmts: Node[] = [];

    for (const child of children.flat()) {
        const newObj = copyObj(obj);
        if (child.stmts) { stmts.push(...child.stmts); }
        // expr === null which happens in some cases when the declarator has no expression due to normalization
        if (child.expr == null) continue;
        newObj.declarations = [child.expr];
        stmts.push(newObj)
    }

    return {
        stmts: [...stmts],
        expr: null,
    };
};

export function normVariableDeclarator(obj: VariableDeclarator, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    let stmts: Node[] = [];

    // children 0 is identifier
    // newObj.id = children[0].expr;

    // children 1 is init
    const newInit = children[1];
    if (newInit) {
        if (newInit.expr && newInit.expr.type === "ObjectExpression") {
            const objExpr = newInit.expr;
            // push empty object for this identifier
            newObj.init = createEmptyObject();

            const newAssignments: Array<ExpressionStatement> = [];
            // push declarations for each property using accesses to new variable
            objExpr.properties.forEach((prop) => {
                if (prop.type === "Property") {
                    const propKey = createIdentifierFromExpression(prop.key as Expression);
                    const propValue = prop.value as Expression;
                    if (propKey && propValue)
                        newAssignments.push(createPropertyAssignment(newObj.id, propKey, propValue));
                }
            });

            const newDecl: VariableDeclaration = copyObj(parent);
            newDecl.declarations = [newObj];
            stmts = [...newInit.stmts, newDecl, ...newAssignments];

            return {
                stmts,
                expr: null,
            };
        }

        // all other init types
        stmts = [...newInit.stmts];
        const newInitExpression = newInit.expr;
        newObj.init = newInitExpression;
    }

    return {
        stmts,
        expr: newObj,
    };
};

export function normTaggedTemplateExpression(obj: TaggedTemplateExpression, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    const newObj = copyObj(obj);
    newObj.tag = children[0].expr;
    newObj.quasi = children[1].expr;

    return {
        stmts: [...stmts],
        expr: newObj,
    }
};

export function normTemplateLiteral(obj: TemplateLiteral, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    const stmts = flatStmts(children);
    newObj.expressions = flatExprs(children);

    return {
        stmts: [...stmts],
        expr: newObj,
    };

};

export function normBlockStatement(obj: Node, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    // shouldn't really be anything here
    const exprs = flatExprs(children).filter((elem) => elem != null);

    const newObj = copyObj(obj);
    newObj.body = [...stmts, ...exprs];
    return {
        stmts: [newObj],
        expr: null,
    };
};

export function normIfStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;

    if (children[1].stmts && children[1].stmts.length > 1) {
        const newConsequentBlock: BlockStatement = { type: "BlockStatement", body: children[1].stmts as Statement[] }
        newObj.consequent = newConsequentBlock;
    } else {
        [newObj.consequent] = children[1].stmts;
    }

    if (newObj.alternate) {
        [newObj.alternate] = children[2].stmts;
    }

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

export function normConditionalExpression(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    newObj.consequent = children[1].expr;
    newObj.alternate = children[2].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, ...children[2].stmts],
        expr: newObj,
    };
};

export function createBlockStatement(stmts: Statement[]): Node {
    if (stmts.length == 1 && stmts[0].type == "BlockStatement") {
        return stmts[0];
    }

    return { type: "BlockStatement", body: stmts};
}

export function concatToBody(body: BlockStatement, stmt: Statement): BlockStatement {
    const newBlock = copyObj(body);
    newBlock.body = newBlock.body.concat(stmt);
    return newBlock;
}

export function normWhileStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    // console.log("children", JSON.stringify(children, null, 2));
    newObj.body = createBlockStatement([...children[1].stmts] as Statement[]);

    const objId = newObj.test.name;
    children[0].stmts.forEach((stmt) => {
        if (stmt.type == "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type == "VariableDeclarator"
            && stmt.declarations[0].id.type == "Identifier" && stmt.declarations[0].id.name == objId && stmt.declarations[0].init) {
                stmt.kind = "let";
                const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init)
                newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

export function normDoWhileStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.type = "WhileStatement";
    newObj.test = children[0].expr;
    newObj.body = createBlockStatement([...children[1].stmts] as Statement[]);

    // First create test condition = true
    const boolObj: SimpleLiteral = createBooleanLiteral(true);
    const objId: string = (children[0].expr as Identifier).name;
    const { id, decl } = createVariableDeclaration(boolObj, objId, false);

    // Change test declaration to assignment (if exists)
    children[0].stmts.forEach((stmt) => {
        if (stmt.type == "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type == "VariableDeclarator"
            && stmt.declarations[0].id.type == "Identifier" && stmt.declarations[0].id.name == objId && stmt.declarations[0].init) {
                const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init)
                // Append condition statement to the end of body
                newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [decl, newObj],
        expr: null,
    };
};

export function normForStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.type = "WhileStatement";
    newObj.test = children[1].expr;
    newObj.body = createBlockStatement([...children[3].stmts, ...children[2].stmts] as Statement[]);

    const objId = newObj.test.name;
    children[1].stmts.forEach((stmt) => {
        if (stmt.type == "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type == "VariableDeclarator"
            && stmt.declarations[0].id.type == "Identifier" && stmt.declarations[0].id.name == objId && stmt.declarations[0].init) {
                // Append test condition
                stmt.kind = "let";
                const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init)
                newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, newObj],
        expr: null,
    };
};

// TODO: Ask Prof. José what should be done in this case
// IDEA: change it to a while??
// function normForStatement(obj, children, parent) {
//     const stmts = children[0].stmts.concat(children[2].stmts);

//     const newObj = copyObj(obj);
//     newObj.init = children[0].expr;
//     //newObj.test = children[1].expr;
//     newObj.update = children[2].expr;
//     newObj.body = children[3].stmts[0];

//     return {
//         stmts: stmts.concat(newObj),
//         expr: null,
//     };
// }

export function normAssignmentExpressions (obj: AssignmentExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);

    const leftExpr = children[0].expr;
    const rightExpr = children[1].expr;

    // if both left and right expression were not normalized we just ignore
    if (leftExpr && rightExpr) {
        newObj.left = leftExpr;

        if (rightExpr.type === "ObjectExpression") {
            // push empty object for this identifier
            newObj.right = createEmptyObject();

            const newAssignments: Array<ExpressionStatement> = [];
            // push declarations for each property using accesses to new variable
            rightExpr.properties.forEach((prop) => {
                if (prop.type === "Property") {
                    const propKey = createIdentifierFromExpression(prop.key as Expression);
                    const propValue = prop.value as Expression;
                    if (propKey && propValue)
                        newAssignments.push(createPropertyAssignment(newObj.left, propKey, propValue));
                }
            });

            const newExprStmt: ExpressionStatement = copyObj(parent);
            newExprStmt.expression = newObj;

            return {
                stmts: [...children[1].stmts, newExprStmt, ...newAssignments],
                expr: null,
            };
        } else if (rightExpr.type === "FunctionExpression") {

            let functionIdentifier;
            if (rightExpr.id) {
                // create variable with the same name as function
                functionIdentifier = createIdentifierWithName(rightExpr.id.name);
            } else {
                // create new random identifier
                functionIdentifier = createRandomIdentifier();
            }

            let newRightExpr = copyObj(rightExpr);
            delete newRightExpr.id;
            const { id, decl } = createVariableDeclarationWithIdentifier(functionIdentifier, newRightExpr);

            newObj.right = functionIdentifier;

            return {
                stmts: [...children[1].stmts, decl],
                expr: newObj,
            };
        }

        newObj.right = rightExpr;

        return {
            stmts: [...children[0].stmts, ...children[1].stmts],
            expr: newObj,
        };
    }

    return { stmts: [], expr: newObj };
};

export function normExpressionStatement(obj: ExpressionStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const expression = children[0].expr;

    // if the expression was not normalization we just ignore
    if (expression) {
        newObj.expression = expression;
        return {
            stmts: [...children[0].stmts, newObj],
            expr: null,
        };
    }

    return {
        stmts: [...flatStmts(children)],
        expr: null,
    };
};

export function normUpdateExpression(obj: UpdateExpression | UnaryExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const argument = children[0].expr;

    // if the argument was not normalization we just ignore
    if (argument) {
        newObj.argument = argument;

        const { id, decl } = createVariableDeclaration(newObj);

        return {
            stmts: [...children[0].stmts, decl],
            expr: id,
        };
    }

    return { stmts: [], expr: newObj };
};

export function normFunctionDeclaration(obj: FunctionDeclaration, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.type = "FunctionExpression";

    const funcId = children[0];
    const funcBody = children[1];

    [newObj.body] = funcBody.stmts;

    if (funcId) {
        const funcIdentifier: Identifier = <Identifier> funcId.expr;
        newObj.id = null;

        const { id, decl } = createVariableDeclarationWithIdentifier(funcIdentifier, newObj);

        return {
            stmts: [decl],
            expr: null,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);

    return {
        stmts: [decl],
        expr: null,
    };
};

export function normLabeledStatement(obj: LabeledStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.id = children[0].expr;

    [newObj.body] = children[1].stmts;

    return {
        stmts: [newObj],
        expr: null,
    };
};

export function normReturnStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    // check if there are any arguments
    if (children[0]) {
        newObj.argument = children[0].expr;

        return {
            stmts: [...children[0].stmts, newObj],
            expr: null,
        };
    }

    return {
        stmts: [newObj],
        expr: null,
    };
};

export function normFunctionExpression(obj: FunctionExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    let stmts: Node[] = [];

    if (children[0]) {
        newObj.id = children[0].expr;
    }

    [newObj.body] = children[1].stmts;

    if (parent
        && (parent.type === "VariableDeclarator"
            || parent.type === "ExpressionStatement"
            || parent.type === "AssignmentExpression"
            || parent.type === "MethodDefinition"
            || (parent.type === "Property" && (parent.kind === "set" || parent.kind === "get")))) {
        return {
            stmts: [],
            expr: newObj,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);
    stmts.push(decl);

    return {
        stmts,
        expr: id,
    };
};

export function normArrowFunctionExpression(obj: ArrowFunctionExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    let stmts: Node[] = [];

    if (children[0].expr) { // body is an expression
        newObj.body = children[0].expr;
        stmts = children[0].stmts;
    } else { // body is a block statement
        [newObj.body] = children[0].stmts;
    }

    if (parent
        && (parent.type === "VariableDeclarator"
            || parent.type === "ExpressionStatement"
            || parent.type === "AssignmentExpression")) {
        return {
            stmts,
            expr: newObj,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);
    stmts.push(decl);

    return {
        stmts,
        expr: id,
    };
};


export function normCallExpression(obj: CallExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.callee = children[0].expr;
    newObj.arguments = flatExprs(children.slice(1));

    if (parent
        && (parent.type === "VariableDeclarator"
            || parent.type === "AssignmentExpression"
            || parent.type === "AwaitExpression")) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);

    return {
        stmts: [...flatStmts(children), decl],
        expr: id,
    };
};

export function normMemberExpression(obj: MemberExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.property = children[1].expr;

    if (parent
        && (parent.type === "VariableDeclarator"
            || parent.type === "ExpressionStatement"
            || parent.type === "AssignmentExpression")) {
        return {
            stmts: [...children[0].stmts, ...children[1].stmts],
            expr: newObj,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, decl],
        expr: id,
    };
}

export function normObjectExpression(obj: ObjectExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.properties = [...flatExprs(children)];

    if (parent
        && (parent.type === "VariableDeclarator"
            || parent.type === "ExpressionStatement"
            || parent.type === "AssignmentExpression")) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);

    return {
        stmts: [...flatStmts(children), decl],
        expr: id,
    };
};

export function normProperty(obj: Property, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    const normalizedKey = children[0];
    const normalizedValue = children[1];

    const keyStmts = [...normalizedKey.stmts];
    const valueStmts = [...normalizedValue.stmts];

    const keyExpr = normalizedKey.expr;
    if (keyExpr && isNotLiteral(keyExpr)) {
        const { id, decl } = createVariableDeclaration(keyExpr as Expression);
        newObj.key = id;
        keyStmts.push(decl);
    } else {
        newObj.key = keyExpr;
    }

    const valueExpr = normalizedValue.expr;
    if (valueExpr && isNotLiteral(valueExpr) && isNotEmpty(valueExpr) && isNotPropertyMethod(obj)) {
        const { id, decl } = createVariableDeclaration(valueExpr as Expression);
        newObj.value = id;
        valueStmts.push(decl);
    } else {
        newObj.value = valueExpr;
    }

    return {
        stmts: [...keyStmts, ...valueStmts],
        expr: newObj,
    };
}

export function normArrayExpression(obj: ArrayExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.elements = [...flatExprs(children)];

    if ((parent && (parent.type === "ExpressionStatement" || parent.type === "VariableDeclarator" ||  parent.type === "AssignmentExpression" )) || !isNotEmpty(obj))
        return {
            stmts: [...flatStmts(children)],
            expr: newObj,
        };
    else {
        const { id, decl } = createVariableDeclaration(newObj);
        return {
            stmts: [...flatStmts(children), decl],
            expr: id,
        };
    }
}

export function normClassExpression(obj: ClassExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const classBodyNormalization = children[2];

    if (classBodyNormalization.expr) {
        newObj.body = classBodyNormalization.expr;
    }

    return {
        stmts: [],
        expr: newObj,
    };
}

export function normClassBody(obj: ClassBody, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.body = [...flatExprs(children)];

    return {
        stmts: [],
        expr: newObj,
    };
}

export function normMethodDefinition(obj: MethodDefinition, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const [keyNormalization, valueNormalization] = children;

    if (keyNormalization.expr) {
        newObj.key = keyNormalization.expr;
    }

    if (valueNormalization.expr) {
        newObj.value = valueNormalization.expr;
    }

    return {
        stmts: [],
        expr: newObj,
    };
}

export function normAwaitYieldExpression(obj: AwaitExpression | YieldExpression | SpreadElement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const [argumentNormalization] = children;

    if (argumentNormalization.expr) {
        newObj.argument = argumentNormalization.expr;
    }

    return {
        stmts: [...flatStmts(children)],
        expr: newObj,
    };
}

export function normSequenceExpression(obj: SequenceExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.expressions = [...flatExprs(children)];

    return {
        stmts: [...flatStmts(children)],
        expr: newObj,
    };
}