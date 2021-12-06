// eslint-disable-next-line no-unused-vars
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
    LabeledStatement,
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

interface CreatedDeclaration {
    id: Identifier,
    decl: VariableDeclaration,
};

interface CreatedDeclarator {
    id: Identifier,
    decl: VariableDeclarator,
};

export function createVariableDeclaration(obj: Expression | null | undefined): CreatedDeclaration {
    const id = createRandomIdentifier();

    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id,
                init: obj,
            },
        ],
        kind: "const",
    };

    return { id, decl };
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

export function normBinaryExpression(obj: BinaryExpression|LogicalExpression, children: Normalization[]): Normalization {
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

export function normVariableDeclaration(obj: VariableDeclaration, children: Normalization[]): Normalization {
    const childStmts = flatStmts(children);

    // remove expr === null which happens in some cases when
    // the declarator has no expression due to normalization
    const newStmts = flatExprs(children)
        .filter((expr) => expr !== null)
        .map((expr) => {
            const newObj = copyObj(obj);
            newObj.declarations = [expr];
            return newObj;
    });

    return {
        stmts: [...childStmts, ...newStmts],
        expr: null,
    };
};

export function normVariableDeclarator(obj: VariableDeclarator, children: Normalization[], parent: VariableDeclaration): Normalization {
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

    [newObj.consequent] = children[1].stmts;

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

export function normWhileStatement(obj: Node, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    [newObj.body] = children[1].stmts;

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

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

    const funcId = children[0];
    const funcBody = children[1];

    if (funcId) {
        newObj.id = funcId.expr;
    }

    [newObj.body] = funcBody.stmts;

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
            || parent.type === "AssignmentExpression")) {
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

export function normCallExpression(obj: CallExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.callee = children[0].expr;
    newObj.arguments = flatExprs(children.slice(1));

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
    if (valueExpr && isNotLiteral(valueExpr) && isNotEmpty(valueExpr)) {
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

export function normArrayExpression(obj: ArrayExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.elements = [...flatExprs(children)];

    return {
        stmts: [...flatStmts(children)],
        expr: newObj,
    };
}

function mapReduce(arr: (Node | null)[], p: Node): Normalization[] {
    return arr.map((item) => normalize(item, p));
}

export function normalizeScript(ast: Program): Program {
    const normalized = normalize(ast, null);
    if (normalized) return normalized.stmts[0] as Program;
    return ast;
}

function normalize(obj: Node | null | undefined, parent: Node | null): Normalization {
    if (obj === null || obj === undefined) {
        return {
            stmts: [],
            expr: null,
        };
    }

    switch (obj.type) {
    //
    // Scripts
    //
    case "Program": {
        const resultData = mapReduce(obj.body, obj);
        return normProgram(obj, resultData);
    }

    case "Identifier":
    case "Literal": {
        return {
            stmts: [],
            expr: copyObj(obj),
        };
    }

    //
    // Expressions
    //
    case "ArrayExpression": {
        const resultData = mapReduce(obj.elements, obj);
        return normArrayExpression(obj, resultData);
    }

    case "ObjectExpression": {
        const resultData = mapReduce(obj.properties, obj);
        return normObjectExpression(obj, resultData, parent);
    }

    case "Property": {
        const resultKey = normalize(obj.key, obj);
        const resultValue = normalize(obj.value, obj);

        const resultData = [
            resultKey,
            resultValue,
        ];
        return normProperty(obj, resultData);
    }

    case "MemberExpression": {
        const resultObject = normalize(obj.object, obj);
        const resultProperty = normalize(obj.property, obj);

        const resultData = [
            resultObject,
            resultProperty,
        ];
        return normMemberExpression(obj, resultData, parent);
    }

    case "CallExpression":
    case "NewExpression": {
        const resultCallee = normalize(obj.callee, obj);
        const resultArguments = mapReduce(obj.arguments, obj);

        resultArguments.unshift(resultCallee);
        const resultData = resultArguments;
        return normCallExpression(obj, resultData, parent);
    }

    case "UpdateExpression":
    case "UnaryExpression": {
        const resultData = [normalize(obj.argument, obj)];
        return normUpdateExpression(obj, resultData);
    }

    case "BinaryExpression":
    case "LogicalExpression": {
        const resultLeft = normalize(obj.left, obj);
        const resultRight = normalize(obj.right, obj);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normBinaryExpression(obj, resultData);
    }

    case "AssignmentExpression": {
        const resultLeft = normalize(obj.left, obj);
        const resultRight = normalize(obj.right, obj);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normAssignmentExpressions(obj, resultData, parent);
    }

    // case "SequenceExpression":
    //     const resultData = mapReduce(obj.expressions, obj);
    //     break;

    //
    // Statements and Declarations
    //

    case "BlockStatement": {
        const resultData = mapReduce(obj.body, obj);
        return normBlockStatement(obj, resultData);
    }

    case "DoWhileStatement":
    case "WhileStatement": {
        const resultTest = normalize(obj.test, obj);
        const resultBody = normalize(obj.body, obj);

        const resultData = [
            resultTest,
            resultBody,
        ];
        return normWhileStatement(obj, resultData);
    }

    case "ExpressionStatement": {
        const resultData = [normalize(obj.expression, obj)];
        return normExpressionStatement(obj, resultData);
    }

    // case "ForStatement": {
    //     const resultInit = normalize(obj.init, obj);
    //     const resultTest = normalize(obj.test, obj);
    //     const resultUpdate = normalize(obj.update, obj);
    //     const resultBody = normalize(obj.body, obj);

    //     const resultData = [
    //     resultInit,
    //     resultTest,
    //     resultUpdate,
    //     resultBody
    //     ];
    //     break;
    // }

    // case "ForInStatement": {
    //     const resultLeft = normalize(obj.left, obj);
    //     const resultRight = normalize(obj.right, obj);
    //     const resultBody = normalize(obj.body, obj);

    //     const resultData = [
    //     resultLeft,
    //     resultRight,
    //     resultBody
    //     ];
    //     break;
    // }

    case "FunctionDeclaration": {
        const resultId = normalize(obj.id, obj);
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultId, resultBody];
        return normFunctionDeclaration(obj, resultData);
    }

    // case "LabeledStatement": {
    case "FunctionExpression": {
        const resultId = normalize(obj.id, obj);
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultId, resultBody];
        return normFunctionExpression(obj, resultData, parent);
    }

    case "ArrowFunctionExpression": {
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultBody];
        return normArrowFunctionExpression(obj, resultData, parent);
    }

    case "IfStatement": {
        const resultTest = normalize(obj.test, obj);
        const resultConsequent = normalize(obj.consequent, obj);
        const resultAlternate = normalize(obj.alternate, obj);

        const resultData = [
            resultTest,
            resultConsequent,
            resultAlternate,
        ];
        return normIfStatement(obj, resultData);
    }

    case "ConditionalExpression": {
        const resultTest = normalize(obj.test, obj);
        const resultConsequent = normalize(obj.consequent, obj);
        const resultAlternate = normalize(obj.alternate, obj);

        const resultData = [
            resultTest,
            resultConsequent,
            resultAlternate,
        ];
        return normConditionalExpression(obj, resultData);
    }

    case "ReturnStatement":
    case "ThrowStatement": {
        const resultData = [normalize(obj.argument, obj)];
        return normReturnStatement(obj, resultData);
    }

    // case "SwitchStatement": {
    //     const resultDiscriminant = normalize(obj.discriminant, obj);
    //     const resultCases = mapReduce(obj.cases, obj);

    //     resultCases.unshift(resultDiscriminant);
    //     const resultData = resultCases;
    //     break;
    // }

    // case "SwitchCase": {
    //     const resultTest = normalize(obj.test, obj);
    //     const resultConsequent = mapReduce(obj.consequent, obj);

    //     resultConsequent.unshift(resultTest);
    //     const resultData = resultConsequent;
    //     break;
    // }

    case "VariableDeclaration": {
        const unpatternedDeclarations = unpattern(obj.declarations);
        const resultData = mapReduce(unpatternedDeclarations, obj);
        return normVariableDeclaration(obj, resultData);
    }

    case "VariableDeclarator": {
        const resultId = normalize(obj.id, obj);
        const resultInit = normalize(obj.init, obj);

        const resultData = [resultId, resultInit];
        return normVariableDeclarator(obj, resultData, parent as VariableDeclaration);
    }

    // case "WithStatement": {
    //     const resultObject = normalize(obj.object, obj);
    //     const resultBody = normalize(obj.body, obj);

    //     const resultData = [resultObject, resultBody];
    //     break;
    // }

    // case "TryStatement": {
    //     const resultBlock = normalize(obj.block, obj);
    //     const resultHandler = normalize(obj.handler, obj);
    //     const resultFinalizer = normalize(obj.finalizer, obj);

    //     const resultData = [
    //     resultBlock,
    //     resultHandler,
    //     resultFinalizer
    //     ];
    //     break;
    // }

    // case "CatchClause": {
    //     const resultParam = normalize(obj.param, obj);
    //     const resultBlock = normalize(obj.body, obj);

    //     const resultData = [resultParam, resultBlock];
    //     break;
    // }

    default:
        return {
            stmts: [],
            expr: null,
        };
    }
}
