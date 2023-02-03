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
    Statement,
    LabeledStatement,
    IfStatement,
    TemplateLiteral,
    TaggedTemplateExpression,
    ClassDeclaration,
    TryStatement,
    CatchClause,
    ReturnStatement,
    ForStatement,
    ForInStatement,
    ForOfStatement,
    ThrowStatement,
    DoWhileStatement,
    WhileStatement,
    ConditionalExpression,
    WithStatement,
    ExportDefaultDeclaration,
    ExportNamedDeclaration,
    SwitchCase,
    SwitchStatement,
    ArrayPattern,
    RestElement,
    Class,
    Pattern,
} from "estree";
import { CANCELLED } from "dns";

export interface Normalization {
    stmts: Node[],
    expr: Node | null,
}

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
}

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
}

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
}

interface CreatedDeclarator {
    id: Identifier,
    decl: VariableDeclarator,
}

export function createVariableDeclaration(obj: Expression | null | undefined, objId?: string, constant: boolean = true): CreatedDeclaration {
    const id = (objId)? createIdentifierWithName(objId) : createRandomIdentifier();

    if (!obj) {
        constant = false;
    }

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
}

export function createVariableDeclarationWithIdentifier(identifier: Identifier, obj: Expression | null | undefined, constant: boolean = true): CreatedDeclaration {
    if (!obj) {
        constant = false;
    }

    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: identifier,
                init: obj,
            },
        ],
        kind: (constant)? "const" : "let",
    };

    return { id: identifier, decl };
}

export function createComputedMemberExpression(obj: Expression, index: number): MemberExpression {
    return {
        type: "MemberExpression",
        computed: true,
        object: obj,
        property: {
            type: "Literal",
            value: index,
            raw: index.toString(),
        },
        optional: false,
    };
}

export function createVariableDeclarator(newInit: Expression | null | undefined): CreatedDeclarator {
    const id = createRandomIdentifier();

    const decl: VariableDeclarator = {
        type: "VariableDeclarator",
        id,
        init: newInit,
    };

    return { id, decl };
}

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
}

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
}

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
}

export function createGenericExpressionAssignment(leftObj: Pattern, objValue: Expression): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: leftObj,
            right: objValue,
        },
    };
}

export function createIfStatementForSwitchCase(test: Expression, consequent: BlockStatement, alternate?: IfStatement | BlockStatement): IfStatement {
    if (alternate) {
        if (alternate.type === "BlockStatement") {
            return {
                type: "IfStatement",
                test: test,
                consequent: consequent,
                alternate: alternate,
            };
        }

        return {
            type: "IfStatement",
            test: test,
            consequent: consequent,
            alternate: {
                type: "BlockStatement",
                body: [ alternate ]
            },
        };
    }

    return {
        type: "IfStatement",
        test: test,
        consequent: consequent,
    };
}

export function createBlockStatementForSwitchCase(originalBody: Statement[], hasBreak: boolean, extraStmt?: IfStatement | BlockStatement): BlockStatement {
    if (hasBreak || !extraStmt) {
        return { type: "BlockStatement", body: originalBody };
    }

    if (extraStmt.type === "BlockStatement") {
        return { type: "BlockStatement", body: [ ...originalBody, ...extraStmt.body ] };
    }

    return { type: "BlockStatement", body: [ ...originalBody, extraStmt ] };
}

export function createEmptyFunctionExpression(id: Identifier): FunctionExpression {
    return {
        type: "FunctionExpression",
        id,
        params: [],
        body: createBlockStatement([]),
    };
}

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
}

export const flatStmts = (children: Normalization[]): Node[] => children.map((child) => child.stmts).flat();
export const flatExprs = (children: Normalization[]): (Node | null)[] => children.map((child) => child.expr).flat();
export const isNotPropertyMethod = (obj: Node): boolean => obj.type !== "Property";
export const isNotLiteral = (obj: Node): boolean => obj.type !== "Literal" && obj.type !== "Identifier";
export function isNotEmpty (obj: Node): boolean {
    if (obj.type === "ArrayExpression") {
        return obj.elements.length > 0;
    }
    return true;
}

export function normProgram(obj: Program, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.body = flatStmts(children);
    return { stmts: [newObj], expr: null };
}

export function normSimpleExpression(obj: Node): Normalization {
    return { stmts: [], expr: copyObj(obj) };
}

export function normSimpleStatement(obj: Node): Normalization {
    return { stmts: [ copyObj(obj) ], expr: null };
}

export function normBinaryExpression(obj: BinaryExpression | LogicalExpression, children: Normalization[],  parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    const leftExpr = children[0].expr;
    const rightExpr = children[1].expr;

    // if both left and right expression were not normalized we just ignore
    if (leftExpr && rightExpr) {
        newObj.left = children[0].expr;
        newObj.right = children[1].expr;

        if (parent && (parent.type === "AssignmentExpression" || parent.type === "VariableDeclarator")) {
            return {
                stmts: [...children[0].stmts, ...children[1].stmts],
                expr: newObj,
            };
        }
        else {
            const { id, decl } = createVariableDeclaration(newObj);

            return {
                stmts: [...children[0].stmts, ...children[1].stmts, decl],
                expr: id,
            };
        }

    }

    return { stmts: [], expr: newObj };
}

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
}

export function normVariableDeclarator(obj: VariableDeclarator, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    let stmts: Node[] = [];

    // children 0 is id
    const newId = children[0];

    // children 1 is init
    const newInit = children[1];
    if (newInit) {
        if (newId.expr && newId.expr.type === "ArrayPattern") {
            const newDeclarations: Array<VariableDeclaration> = [];
            const patternElements = newId.expr.elements;

            if (newInit.expr) {
                if (newInit.expr.type === "ArrayExpression") {
                    const arrayElements = newInit.expr.elements;

                    if (patternElements.length === arrayElements.length) {
                        for (let i = 0; i < patternElements.length; i++) {
                            const patternId = patternElements[i];
                            const arrayExpr = arrayElements[i];
                            if (patternId && arrayExpr) {
                                const decl = createVariableDeclarationWithIdentifier(patternId as Identifier, arrayExpr as Expression);
                                newDeclarations.push(decl.decl);
                            }
                        }
                    }
                } else {
                    for (let i = 0; i < patternElements.length; i++) {
                        const patternId = patternElements[i];
                        const arrayExpr = createComputedMemberExpression(newInit.expr as Expression, i);
                        if (patternId && arrayExpr) {
                            const decl = createVariableDeclarationWithIdentifier(patternId as Identifier, arrayExpr as Expression);
                            newDeclarations.push(decl.decl);
                        }
                    }
                }

                stmts = [...newInit.stmts, ...newDeclarations];
                return {
                    stmts,
                    expr: null,
                };
            }
        }

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

        if (newInit.expr && newInit.expr.type === "ConditionalExpression") {
            const newDecl: VariableDeclaration = copyObj(parent);
            newDecl.kind = "let";
            newObj.init = null;
            newDecl.declarations = [newObj];

            const newTest = newInit.expr.test;

            const newConsequentExpression = createExpressionAssignment(newObj.id.name, newInit.expr.consequent);
            const newConsequent = createBlockStatement([newConsequentExpression]);

            const newAlternateExpression = createExpressionAssignment(newObj.id.name, newInit.expr.alternate);
            const newAlternate = createBlockStatement([newAlternateExpression]);

            const newIfStatement: IfStatement = createIfStatementForSwitchCase(newTest, newConsequent, newAlternate);

            stmts = [...newInit.stmts, newDecl, newIfStatement];
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
}

export function normTaggedTemplateExpression(obj: TaggedTemplateExpression, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    const newObj = copyObj(obj);
    newObj.tag = children[0].expr;
    newObj.quasi = children[1].expr;

    return {
        stmts: [...stmts],
        expr: newObj,
    }
}

export function normTemplateLiteral(obj: TemplateLiteral, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);

    const stmts = flatStmts(children);
    newObj.expressions = flatExprs(children);

    if (parent &&
        (parent.type === "CallExpression"
        || parent.type === "ReturnStatement")) {
        const { id, decl } = createVariableDeclaration(newObj);
        return {
            stmts: [...flatStmts(children), decl],
            expr: id,
        };
    }

    return {
        stmts: [...stmts],
        expr: newObj,
    };

}

export function normBlockStatement(obj: BlockStatement, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    // shouldn't really be anything here
    const exprs = flatExprs(children).filter((elem) => elem != null);

    const newObj = copyObj(obj);
    newObj.body = [...stmts, ...exprs];
    return {
        stmts: [newObj],
        expr: null,
    };
}

export function normIfStatement(obj: IfStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;

    newObj.consequent = createBlockStatement(children[1].stmts as Statement[])

    if (newObj.alternate) {
        newObj.alternate = createBlockStatement(children[2].stmts as Statement[])
    }

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
}

export function createEqualBinaryExpression(left: Expression, right: Expression): BinaryExpression {
    return {
        type: "BinaryExpression",
        operator: "===",
        left,
        right
    };
}

export function normSwitchStatement(obj: Node, children: Normalization[]): Normalization {
    // children = children.slice(0,2);
    return {
        stmts: flatStmts(children),
        expr: null,
    };
}

export function rearrangeSwitchCases(cases: SwitchCase[]): SwitchCase[] {
    const defaultCase = cases.filter(switchCase => !switchCase.test);
    const otherCases = cases.filter(switchCase => switchCase.test);
    return [...otherCases, ...defaultCase];
}

export function normSwitchCases(obj: Node, cases: SwitchCase[], childrenList: Normalization[][], parent: Node | null ): Normalization {
    const parentDiscriminant = parent && (parent.type === "Identifier" || parent.type === "Literal") ? parent : createRandomIdentifier();

    const previousDecls: Statement[] = [];
    let ifNode: Node | undefined = undefined;

    for (let j = cases.length - 1; j >= 0; j--) {
        const switchCase = cases[j];
        const children = childrenList[j];

        const flatChildrenStmts = flatStmts(children);
        const hasBreak = flatChildrenStmts.filter(stmt => stmt.type === "BreakStatement").length > 0;
        const newBody = flatChildrenStmts.filter(stmt => stmt.type != "BreakStatement") as Statement[];
        const newConsequent = createBlockStatementForSwitchCase(newBody, hasBreak, ifNode);

        if (switchCase.test) {
            const caseTest = createEqualBinaryExpression(parentDiscriminant, children[0].expr as Expression);
            const newTest = createVariableDeclaration(caseTest);

            ifNode = createIfStatementForSwitchCase(newTest.id, newConsequent, ifNode);
            previousDecls.push(newTest.decl);
        } else {
            ifNode = newConsequent;
        }
    }

    if (ifNode) {
        return {
            stmts: [ ...previousDecls, ifNode ],
            expr: null,
        };
    }

    return {
        stmts: [ ...previousDecls ],
        expr: null,
    };
}

// export function normSwitchCase(obj: Node, children: Normalization[], parent: Node | null ): Normalization {
//     const parentDiscriminant = parent && parent.type == "Identifier" ? parent : createRandomIdentifier();

//     const caseTest = createEqualBinaryExpression(parentDiscriminant, children[0].expr as Expression);
//     const newTest = createVariableDeclaration(caseTest);

//     children.shift();
//     const newBody = flatStmts(children).filter(stmt => stmt.type != "BreakStatement") as Statement[];
//     const newConsequent: BlockStatement = { type: "BlockStatement", body: newBody };

//     const newObj: IfStatement = { type: "IfStatement", test: newTest.id, consequent: newConsequent };

//     return {
//         stmts: [newTest.decl, newObj],
//         expr: null,
//     };
// }

export function normConditionalExpression(obj: ConditionalExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    newObj.consequent = children[1].expr;
    newObj.alternate = children[2].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, ...children[2].stmts],
        expr: newObj,
    };
}

export function createBlockStatement(stmts: Statement[]): BlockStatement {
    if (stmts.length == 1 && stmts[0].type == "BlockStatement") {
        return stmts[0];
    }
    else if (stmts.length >= 1) {
        const newStmts = stmts.map((stmt) => { if (stmt.type == "BlockStatement") return stmt.body; else return stmt }).flat()
        return { type: "BlockStatement", body: newStmts};
    }
    return { type: "BlockStatement", body: stmts};
}

export function concatToBody(body: BlockStatement, stmt: Statement): BlockStatement {
    const newBlock = copyObj(body);
    newBlock.body = newBlock.body.concat(stmt);
    return newBlock;
}

export function normWhileStatement(obj: WhileStatement, children: Normalization[]): Normalization {
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
}

export function normForInStatement(obj: ForInStatement | ForOfStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    newObj.right = children[1].expr;
    newObj.body = createBlockStatement([...children[2].stmts] as Statement[]);

    if (!children[0].expr && children[0].stmts[0].type == "VariableDeclaration" ){
        const decl = children[0].stmts[0];
        decl.kind = "let";
        newObj.left = decl.declarations[0].id;
    }
    else {
        newObj.left = children[0].expr;
    }

    return {
        stmts: [...children[0].stmts,...children[1].stmts, newObj],
        expr: null,
    };
}

export function normDoWhileStatement(obj: DoWhileStatement, children: Normalization[]): Normalization {
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
}

export function normForStatement(obj: ForStatement, children: Normalization[]): Normalization {
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
}

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
        } else if (rightExpr.type === "ConditionalExpression") {
            const newTest = rightExpr.test;

            let newConsequentExpression, newAlternateExpression;
            if (leftExpr.type == "Identifier") {
                newConsequentExpression = createExpressionAssignment(newObj.id.name, rightExpr.consequent);
                newAlternateExpression = createExpressionAssignment(newObj.id.name, rightExpr.alternate);
            } else {
                newConsequentExpression = createGenericExpressionAssignment(leftExpr as Pattern, rightExpr.consequent);
                newAlternateExpression = createGenericExpressionAssignment(leftExpr as Pattern, rightExpr.alternate);
            }
            const newConsequent = createBlockStatement([newConsequentExpression]);
            const newAlternate = createBlockStatement([newAlternateExpression]);

            const newIfStatement: IfStatement = createIfStatementForSwitchCase(newTest, newConsequent, newAlternate);

            const stmts = [...children[0].stmts, ...children[1].stmts, newIfStatement];
            return {
                stmts,
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
}

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
}

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
}

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
}

export function normLabeledStatement(obj: LabeledStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.id = children[0].expr;

    [newObj.body] = children[1].stmts;

    return {
        stmts: [newObj],
        expr: null,
    };
}

export function normReturnStatement(obj: ReturnStatement | ThrowStatement, children: Normalization[]): Normalization {
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
}

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
}

export function normArrowFunctionExpression(obj: ArrowFunctionExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.type = "FunctionExpression";
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
}


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
}

export function normMemberExpression(obj: MemberExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.property = children[1].expr;

    if (parent
        && (parent.type === "VariableDeclarator"
            // || parent.type === "ExpressionStatement"
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

    if (parent?.type == "Property") {
        const { id, decl } = createVariableDeclaration(createEmptyObject());
        const newAssignments: Array<ExpressionStatement> = [];
        // push declarations for each property using accesses to new variable
        newObj.properties.forEach((prop: Property) => {
            if (prop.type === "Property") {
                const propKey = createIdentifierFromExpression(prop.key as Expression);
                const propValue = prop.value as Expression;
                if (propKey && propValue)
                    newAssignments.push(createPropertyAssignment(id, propKey, propValue));
            }
        });

        return {
            stmts: [...flatStmts(children), decl, ...newAssignments],
            expr: id,
        };
    }

    const { id, decl } = createVariableDeclaration(newObj);
    const stmts = flatStmts(children);
    return {
        stmts: [...stmts, decl],
        expr: id,
    };
}

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

export function normArrayPattern(obj: ArrayPattern, children: Normalization[], parent: Node | null): Normalization {
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

// export function normRestElement(obj: RestElement, children: Normalization[]): Normalization {
//     const newObj = copyObj(obj);
//     return {
//         stmts: [],
//         expr: newObj,
//     };
// }

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

// https://stackoverflow.com/questions/8242697/javascript-functions-to-simulate-classes-best-practices
export function normClassDeclaration(obj: ClassDeclaration, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const stmts: any = [];

    const id: Identifier = newObj.id;
    // const superClass = children[1];
    const classBodyNormalization = children[2];

    const funcExpr = createEmptyFunctionExpression(id);
    let funcDecl = createVariableDeclarationWithIdentifier(id, funcExpr, true);

    if (classBodyNormalization.expr) {
        const classBody = classBodyNormalization.expr as ClassBody;
        const methods = classBody.body;
        methods.forEach(method => {
            const key = method.key as Identifier;
            if (key.name == "constructor") {
                const constructorMethod = method.value as FunctionExpression;
                constructorMethod.id = id;
                funcDecl = createVariableDeclarationWithIdentifier(id, constructorMethod, true);
            } else {
                const newMethod = createVariableDeclarationWithIdentifier(key, method.value, true);
                stmts.push(newMethod.decl);
                const newAssignment = createPropertyAssignment(id, key, newMethod.id);
                stmts.push(newAssignment);
            }
        });
    }

    return {
        stmts: [ funcDecl.decl, ...stmts],
        expr: null,
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
        const method = valueNormalization.expr as FunctionExpression;
        method.id = newObj.key;
        newObj.value = method;
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

export function normTryStatement(obj: TryStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.block = children[0].stmts[0];
    newObj.handler = children[1].expr;

    if (children[2]) {
        newObj.finalizer = children[2].stmts[0];
    }

    return {
        stmts: [...children[1].stmts, newObj],
        expr: null,
    };
}

export function normCatchClause(obj: CatchClause, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.param = children[0].expr;
    newObj.body = children[1].stmts[0];

    return {
        stmts: [...children[0].stmts],
        expr: newObj,
    };
}

export function normWithStatement(obj: WithStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.body = children[1].stmts[0];

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
}

export function normExportDeclaration(obj: ExportDefaultDeclaration | ExportNamedDeclaration, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    if (children[0].expr) {
        newObj.declaration = children[0].expr;
        return {
            stmts: [...children[0].stmts, newObj],
            expr: null,
        };
    }

    newObj.declaration = children[0].stmts[0];

    return {
        stmts: [newObj],
        expr: null,
    };
}