import { copyObj, getNextVariableName } from "../../utils/utils";

import type {
    ArrayExpression,
    ArrayPattern,
    ArrowFunctionExpression,
    AssignmentExpression, AssignmentPattern,
    AwaitExpression,
    BinaryExpression,
    BlockStatement,
    CallExpression,
    CatchClause,
    ClassBody,
    ClassDeclaration,
    ClassExpression,
    ConditionalExpression,
    DoWhileStatement,
    ExportDefaultDeclaration,
    ExportNamedDeclaration,
    Expression,
    ExpressionStatement,
    ForInStatement,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    FunctionExpression,
    Identifier,
    IfStatement,
    LabeledStatement, Literal,
    LogicalExpression,
    MemberExpression,
    MethodDefinition,
    Node,
    ObjectExpression,
    Pattern,
    Program,
    Property, RestElement,
    ReturnStatement,
    SequenceExpression,
    SimpleLiteral,
    SourceLocation,
    SpreadElement,
    Statement,
    SwitchStatement,
    TaggedTemplateExpression,
    TemplateLiteral,
    ThrowStatement,
    TryStatement,
    UnaryExpression,
    UpdateExpression,
    VariableDeclaration,
    VariableDeclarator,
    WhileStatement,
    WithStatement,
    YieldExpression
} from "estree";

export interface Normalization {
    stmts: Node[]
    expr: Node | null
}

export function createRandomIdentifier(): Identifier {
    const variableName = getNextVariableName();
    return {
        type: "Identifier",
        name: variableName
    };
}

export function createIdentifierWithName(name: string): Identifier {
    return {
        type: "Identifier",
        name
    };
}

export function createIdentifierFromExpression(expr: Expression): Identifier | null {
    switch (expr.type) {
        case "Identifier": {
            return expr;
        }

        case "Literal": {
            return createIdentifierWithName(expr?.value as string);
        }
        default:
            console.trace("Expression didn't match with case values.");
            return null;
    }
}

export function createEmptyObject(): ObjectExpression {
    return {
        type: "ObjectExpression",
        properties: []
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
    id: Identifier
    decl: VariableDeclaration
}

interface CreatedDeclarator {
    id: Identifier
    decl: VariableDeclarator
}

export function createVariableDeclaration(obj: Expression | null | undefined, originalSource: SourceLocation | null | undefined, objId?: string, constant: boolean = true): CreatedDeclaration {
    const id = (objId) ? createIdentifierWithName(objId) : createRandomIdentifier();

    if (!obj) {
        constant = false;
    }

    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id,
                init: obj
            }
        ],
        kind: (constant) ? "const" : "let",
        loc: originalSource
    };

    return { id, decl };
}

export function createVariableDeclarationWithIdentifier(identifier: Identifier, obj: Expression | null | undefined, originalSource: SourceLocation | null | undefined, constant: boolean = true): CreatedDeclaration {
    if (!obj) {
        constant = false;
    }

    const decl: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: identifier,
                init: obj
            }
        ],
        kind: (constant) ? "const" : "let",
        loc: originalSource
    };

    return { id: identifier, decl };
}

export function createComputedMemberExpression(obj: Expression, index: number, originalSource: SourceLocation | null | undefined): MemberExpression {
    return {
        type: "MemberExpression",
        computed: true,
        object: obj,
        property: {
            type: "Literal",
            value: index,
            raw: index.toString()
        },
        optional: false,
        loc: originalSource
    };
}

export function createVariableDeclarator(newInit: Expression | null | undefined, originalSource: SourceLocation | null | undefined): CreatedDeclarator {
    const id = createRandomIdentifier();

    const decl: VariableDeclarator = {
        type: "VariableDeclarator",
        id,
        init: newInit,
        loc: originalSource
    };

    return { id, decl };
}

export function createObjectLookupDeclarator(prop: Property, objectValue: Expression, originalSource: SourceLocation | null | undefined): VariableDeclarator {
    const propValue = prop.value as Expression;
    const propKey = prop.key as Identifier;
    const memExpr: MemberExpression = {
        type: "MemberExpression",
        computed: false,
        optional: false,
        object: objectValue,
        property: propValue,
        loc: originalSource
    };

    return {
        type: "VariableDeclarator",
        id: propKey,
        init: memExpr,
        loc: originalSource
    };
}

export function createPropertyAssignment(objId: Identifier, propKey: Identifier | Literal, propValue: Expression, originalSource: SourceLocation | null | undefined): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: {
                type: "MemberExpression",
                computed: propKey.type !== "Identifier",
                object: objId,
                property: propKey,
                optional: false,
                loc: originalSource
            },
            right: propValue,
            loc: originalSource
        },
        loc: originalSource
    };
}

export function createExpressionAssignment(objId: string, objValue: Expression, originalSource: SourceLocation | null | undefined): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: {
                type: "Identifier",
                name: objId,
                loc: originalSource
            },
            right: objValue,
            loc: originalSource
        },
        loc: originalSource
    };
}

export function createGenericExpressionAssignment(leftObj: Pattern, objValue: Expression, originalSource: SourceLocation | null | undefined): ExpressionStatement {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: leftObj,
            right: objValue,
            loc: originalSource
        },
        loc: originalSource
    };
}

export function createIfStatementForSwitchCase(test: Expression, originalSource: SourceLocation | null | undefined, consequent: BlockStatement, alternate?: IfStatement | BlockStatement): IfStatement {
    if (alternate) {
        if (alternate.type === "BlockStatement") {
            return {
                type: "IfStatement",
                test,
                consequent,
                alternate,
                loc: originalSource
            };
        }

        return {
            type: "IfStatement",
            test,
            consequent,
            alternate: {
                type: "BlockStatement",
                body: [alternate]
            },
            loc: originalSource
        };
    }

    return {
        type: "IfStatement",
        test,
        consequent,
        loc: originalSource
    };
}

export function createEmptyFunctionExpression(id: Identifier, originalSource: SourceLocation | null | undefined): FunctionExpression {
    return {
        type: "FunctionExpression",
        id,
        params: [],
        body: createBlockStatement([]),
        loc: originalSource
    };
}

export function unpattern(declarations: VariableDeclarator[]): VariableDeclarator[] {
    const unpatternedDeclarations: VariableDeclarator[] = [];

    declarations.forEach((d) => {
        if (d.id.type === "ObjectPattern") {
            const originalInit = d.init;
            const { id, decl } = createVariableDeclarator(originalInit, d.loc);

            // push a new variable with the member expression
            unpatternedDeclarations.push(decl);

            // push declarations for each property using accesses to new variable
            d.id.properties.forEach((prop) => {
                if (prop.type === "Property") { unpatternedDeclarations.push(createObjectLookupDeclarator(prop as Property, id, prop.loc)); }
            });
        } else {
            unpatternedDeclarations.push(d);
        }
    });

    return unpatternedDeclarations;
}

export const flatStmts = (children: Normalization[]): Node[] => children.map((child) => child.stmts).flat();
export const flatExprs = (children: Normalization[]): Array<Node | null> => children.map((child) => child.expr).flat();
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
    return { stmts: [copyObj(obj)], expr: null };
}

export function normBinaryExpression(obj: BinaryExpression | LogicalExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    const leftExpr = children[0].expr;
    const rightExpr = children[1].expr;

    // if both left and right expression were not normalized we just ignore
    if (leftExpr && rightExpr) {
        newObj.left = children[0].expr;
        newObj.right = children[1].expr;

        if (parent && (parent.type === "AssignmentExpression" || (parent.type === "VariableDeclarator" && parent.id.type !== "ArrayPattern"))) {
            return {
                stmts: [...children[0].stmts, ...children[1].stmts],
                expr: newObj
            };
        } else {
            const { id, decl } = createVariableDeclaration(newObj, obj.loc);

            return {
                stmts: [...children[0].stmts, ...children[1].stmts, decl],
                expr: id
            };
        }
    }

    return { stmts: [], expr: newObj };
}

export function normVariableDeclaration(obj: VariableDeclaration, children: Normalization[]): Normalization {
    const stmts: Node[] = [];

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
        expr: null
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
            const newDeclarations: VariableDeclaration[] = [];
            const patternElements = newId.expr.elements;
            const lastPatternElement = patternElements[patternElements.length - 1];

            if (newInit.expr) {
                if (newInit.expr.type === "ArrayExpression") {
                    const arrayElements = newInit.expr.elements;

                    if (patternElements.length === arrayElements.length) {
                        for (let i = 0; i < patternElements.length; i++) {
                            const patternId = patternElements[i];
                            const arrayExpr = arrayElements[i];
                            if (patternId && arrayExpr) {
                                const decl = createVariableDeclarationWithIdentifier(patternId as Identifier, arrayExpr as Expression, obj.loc);
                                newDeclarations.push(decl.decl);
                            }
                        }
                    }
                    // If there is RestElement, is always in the last position
                    // If we have a RestElement, we can't separate into different variable declarations because it breaks the normalization
                    // For example: arr = [1,2,3]
                    // If we have let [a, ...b] = arr, then a = 1 and b = [2,3]
                    // But if we separate them, then, the second declaration will be let ...b = arr[1], which does not compile
                } else if (lastPatternElement && lastPatternElement.type === "RestElement") {
                    stmts = [...newId.stmts, ...newInit.stmts];
                    newObj.id = newId.expr;
                    newObj.init = newInit.expr;
                    return { stmts, expr: newObj }
                } else {
                    for (let i = 0; i < patternElements.length; i++) {
                        const patternId = patternElements[i];
                        const arrayExpr = createComputedMemberExpression(newInit.expr as Expression, i, patternId?.loc);
                        if (patternId && arrayExpr) {
                            const decl = createVariableDeclarationWithIdentifier(patternId as Identifier, arrayExpr as Expression, patternId?.loc);
                            newDeclarations.push(decl.decl);
                        }
                    }
                }

                stmts = [...newInit.stmts, ...newDeclarations];
                return {
                    stmts,
                    expr: null
                };
            }
        }

        if (newInit.expr && newInit.expr.type === "ObjectExpression") {
            const objExpr = newInit.expr;
            // push empty object for this identifier
            newObj.init = createEmptyObject();

            const newAssignments: ExpressionStatement[] = [];
            // push declarations for each property using accesses to new variable
            objExpr.properties.forEach((prop) => {
                if (prop.type === "Property") {
                    // const propKey = createIdentifierFromExpression(prop.key as Expression);
                    const propKey = prop.key.type === "Identifier" || prop.key.type === "Literal" ? prop.key : null;
                    const propValue = prop.value as Expression;
                    if (propKey && propValue) {
                        newAssignments.push(createPropertyAssignment(newObj.id, propKey, propValue, newObj.loc));
                    }
                }
            });

            const newDecl: VariableDeclaration = copyObj(parent);
            newDecl.declarations = [newObj];
            stmts = [...newInit.stmts, newDecl, ...newAssignments];

            return {
                stmts,
                expr: null
            };
        }

        if (newInit.expr && newInit.expr.type === "ConditionalExpression") {
            const newDecl: VariableDeclaration = copyObj(parent);
            newDecl.kind = "let";
            newObj.init = null;
            newDecl.declarations = [newObj];

            stmts = [newDecl, ...newInit.stmts];
            return {
                stmts,
                expr: null
            };
        }

        // For cases like { 0: a } = b; --> Instead of 0 = b.a, this should be a = b.0
        if (newId.expr && newId.expr.type === "Literal" && parent && parent.type === "VariableDeclaration" && parent.declarations[0] && parent.declarations[0].id.type === "ObjectPattern") {
            stmts = [...newInit.stmts];
            if (newInit.expr && newInit.expr.type === "MemberExpression") {
                newObj.id = newInit.expr.property;
                newObj.init.computed = true;
                newObj.init.property = newId.expr;
                return {
                    stmts,
                    expr: newObj
                };
            }
        }

        if (newInit.expr && newInit.expr.type === "AssignmentExpression" && parent && parent.type === "VariableDeclaration") {
            const decl = createGenericExpressionAssignment(newInit.expr.left, newInit.expr.right, newInit.expr.loc)
            newObj.init = newInit.expr.left;
            stmts = [...newInit.stmts, decl];
            return {
                stmts,
                expr: newObj
            };
        }

        // all other init types
        stmts = [...newInit.stmts];
        newObj.init = newInit.expr;
    }

    return {
        stmts,
        expr: newObj
    };
}

export function normTaggedTemplateExpression(obj: TaggedTemplateExpression, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    const newObj = copyObj(obj);
    newObj.tag = children[0].expr;
    newObj.quasi = children[1].expr;

    return {
        stmts: [...stmts],
        expr: newObj
    }
}

export function normTemplateLiteral(obj: TemplateLiteral, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);

    const stmts = flatStmts(children);
    newObj.expressions = flatExprs(children);

    if (parent &&
        (parent.type === "CallExpression" ||
            parent.type === "ReturnStatement")) {
        const { id, decl } = createVariableDeclaration(newObj, obj.loc);
        return {
            stmts: [...flatStmts(children), decl],
            expr: id
        };
    }

    return {
        stmts: [...stmts],
        expr: newObj
    }
}

export function normBlockStatement(obj: BlockStatement, children: Normalization[]): Normalization {
    const stmts = flatStmts(children);

    // shouldn't really be anything here
    const exprs = flatExprs(children).filter((elem) => elem != null);

    const newObj = copyObj(obj);
    newObj.body = [...stmts, ...exprs];
    return {
        stmts: [newObj],
        expr: null
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
        expr: null
    };
}

export function normSwitchStatement(obj: SwitchStatement, discriminant: Normalization, tests: Normalization[], consequents: Normalization[][]): Normalization {
    const previousStmts = discriminant.stmts.concat(flatStmts(tests));

    const newObj = copyObj(obj) as SwitchStatement;
    newObj.discriminant = discriminant.expr as Expression;
    const testExprs = tests.map((test) => test.expr) as Expression[];
    const consequentStmts = consequents.map((consequent) => flatStmts(consequent)) as Statement[][];
    newObj.cases.forEach((switchCase, i) => {
        switchCase.test = testExprs[i];
        switchCase.consequent = consequentStmts[i];
    });

    return {
        stmts: [...previousStmts, newObj],
        expr: null
    };
}

export function normConditionalExpression(obj: ConditionalExpression, children: Normalization[], parent: Node | null): Normalization {
    const newTest = children[0].expr ? children[0].expr as Expression : obj.test;
    const consequent = children[1].expr ? children[1].expr as Expression : obj.consequent
    const alternate = children[2].expr ? children[2].expr as Expression : obj.alternate
    let testExpr; const declStmt = [];
    const newConsequentStatements: Statement[] = []; const newAlternateStatements: Statement[] = [];
    // Case where we modify an existing variable on the left side
    if (parent && parent.type === "ExpressionStatement" && parent.expression.type === "AssignmentExpression" && parent.expression.left.type === "Identifier") {
        newConsequentStatements.push(createExpressionAssignment(parent.expression.left.name, consequent, obj.loc));
        newAlternateStatements.push(createExpressionAssignment(parent.expression.left.name, alternate, obj.loc));
        testExpr = parent.expression.left;
    } else if (parent && parent.type === "VariableDeclarator" && parent.id.type === "Identifier") { // Case where we are declaring a new variable on the left side
        newConsequentStatements.push(createExpressionAssignment(parent.id.name, consequent, obj.loc));
        newAlternateStatements.push(createExpressionAssignment(parent.id.name, alternate, obj.loc));
        testExpr = obj;
    } else if (parent && parent.type === "AssignmentExpression" && parent.left.type === "Identifier") {
        newConsequentStatements.push(createGenericExpressionAssignment(parent.left as Pattern, consequent, obj.loc));
        newAlternateStatements.push(createGenericExpressionAssignment(parent.left as Pattern, alternate, obj.loc));
        testExpr = obj;
    } else if (consequent.type === "AssignmentExpression") {
        const newId = createRandomIdentifier();
        const { id, decl } = createVariableDeclarationWithIdentifier(newId, null, obj.loc);
        newConsequentStatements.push(createGenericExpressionAssignment(consequent.left, consequent.right, obj.loc));
        newConsequentStatements.push(createExpressionAssignment(newId.name, consequent.left as Expression, obj.loc));
        newAlternateStatements.push(createGenericExpressionAssignment(newId as Pattern, alternate, obj.loc));
        testExpr = id;
        declStmt.push(decl);
    } else {
        const newId = createRandomIdentifier();
        const { id, decl } = createVariableDeclarationWithIdentifier(newId, null, obj.loc);
        newConsequentStatements.push(createGenericExpressionAssignment(newId as Pattern, consequent, obj.loc));
        newAlternateStatements.push(createGenericExpressionAssignment(newId as Pattern, alternate, obj.loc));
        testExpr = id;
        declStmt.push(decl);
    }
    const newConsequent = createBlockStatement(newConsequentStatements);
    const newAlternate = createBlockStatement(newAlternateStatements);

    const newIfStatement: IfStatement = createIfStatementForSwitchCase(newTest, obj.loc, newConsequent, newAlternate);

    const stmts = [...children[0].stmts, ...children[1].stmts, ...children[2].stmts, ...declStmt, newIfStatement];

    return {
        stmts,
        expr: testExpr
    };
}

export function createBlockStatement(stmts: Statement[]): BlockStatement {
    if (stmts.length === 1 && stmts[0].type === "BlockStatement") {
        return stmts[0];
    } else if (stmts.length >= 1) {
        const newStmts = stmts.map((stmt) => { if (stmt.type === "BlockStatement") return stmt.body; else return stmt }).flat()
        return { type: "BlockStatement", body: newStmts };
    }
    return { type: "BlockStatement", body: stmts };
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
        if (stmt.type === "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type === "VariableDeclarator" &&
            stmt.declarations[0].id.type === "Identifier" && stmt.declarations[0].id.name === objId && stmt.declarations[0].init) {
            stmt.kind = "let";
            const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init, obj.loc)
            newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null
    };
}

export function normForInStatement(obj: ForInStatement | ForOfStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    newObj.right = children[1].expr;
    newObj.body = createBlockStatement([...children[2].stmts] as Statement[]);

    if (!children[0].expr && children[0].stmts[0].type === "VariableDeclaration") {
        const decl = children[0].stmts[0];
        decl.kind = "let";
        newObj.left = decl.declarations[0].id;
    } else {
        newObj.left = children[0].expr;
    }

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, newObj],
        expr: null
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
    const decl = createVariableDeclaration(boolObj, obj.loc, objId, false).decl;

    // Change test declaration to assignment (if exists)
    children[0].stmts.forEach((stmt) => {
        if (stmt.type === "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type === "VariableDeclarator" &&
            stmt.declarations[0].id.type === "Identifier" && stmt.declarations[0].id.name === objId && stmt.declarations[0].init) {
            const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init, obj.loc)
            // Append condition statement to the end of body
            newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [decl, newObj],
        expr: null
    };
}

export function normForStatement(obj: ForStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.type = "WhileStatement";
    newObj.test = children[1].expr;
    newObj.body = createBlockStatement([...children[3].stmts, ...children[2].stmts] as Statement[]);

    const init = children[0];
    let newInit = init.stmts;
    if ((newInit === undefined || newInit.length === 0) && init.expr !== null) {
        newInit = [init.expr];
    }

    if (!newObj.test) { // for (;;)
        newObj.test = { type: "Literal", value: true, raw: "true" }
        return {
            stmts: [newObj],
            expr: null
        };
    }
    const objId = newObj.test.name;
    children[1].stmts.forEach((stmt) => {
        if (stmt.type === "VariableDeclaration" && stmt.declarations[0] && stmt.declarations[0].type === "VariableDeclarator" &&
            stmt.declarations[0].id.type === "Identifier" && stmt.declarations[0].id.name === objId && stmt.declarations[0].init) {
            // Append test condition
            stmt.kind = "let";
            const newAssignment = createExpressionAssignment(objId, stmt.declarations[0].init, obj.loc)
            newObj.body = concatToBody(newObj.body, newAssignment);
        }
    });

    return {
        stmts: [...newInit, ...children[1].stmts, newObj],
        expr: null
    };
}

export function normAssignmentExpressions (obj: AssignmentExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    const leftExpr = children[0].expr;
    const rightExpr = children[1].expr;

    // if both left and right expression were not normalized we just ignore
    if (leftExpr && rightExpr) {
        newObj.left = leftExpr;

        // If there is an assignment inside the call, we need to add an external statement with the assignment and return the left side of the assignment
        const assignmentStatement = [];
        let assignmentValue;
        if (parent && parent.type === "CallExpression" && rightExpr.type !== "ConditionalExpression") {
            assignmentValue = newObj.left;
            const newAssignment = createExpressionAssignment(newObj.left.name, newObj.right, obj.loc)
            assignmentStatement.push(newAssignment);
        }

        // If the right expression is an object expression (not empty) and the left expression is a member expression
        // we need to separate the statements
        // newObj is memExp = newVar
        if ((rightExpr.type === "ObjectExpression" && rightExpr.properties.length) && leftExpr.type === "MemberExpression" && (!parent || parent.type !== "SequenceExpression")) {
            // Create assignment newVar = objExpr (right) and add to statements
            const { id, decl } = createVariableDeclaration(rightExpr, obj.loc);
            // Create assignment memExp (left) = newVar
            newObj.right = id;
            const stmts = [...children[1].stmts, decl]
            return { stmts, expr: newObj }
        } else if (rightExpr.type === "ObjectExpression" && (!parent || parent.type !== "SequenceExpression")) {
            const newAssignments: ExpressionStatement[] = [];
            // push declarations for each property using accesses to new variable
            rightExpr.properties.forEach((prop) => {
                if (prop.type === "Property") {
                    const propKey = prop.key.type === "Identifier" || prop.key.type === "Literal" ? prop.key : null;
                    const propValue = prop.value as Expression;
                    if (propKey && propValue) {
                        newAssignments.push(createPropertyAssignment(newObj.left, propKey, propValue, obj.loc));
                    }
                }
            });
            // push empty object for this identifier
            newObj.right = createEmptyObject();
            if ((!parent || parent.type !== "CallExpression") && rightExpr.properties.length) {
                const newExprStmt: ExpressionStatement = copyObj(parent);
                newExprStmt.expression = newObj;
                newAssignments.push(newExprStmt)
            }
            const stmts = [...children[1].stmts, ...newAssignments]
            return { stmts, expr: assignmentValue ?? newObj }
        } else if (rightExpr.type === "ObjectExpression" && parent && parent.type === "SequenceExpression") {
            const { id, decl } = createVariableDeclaration(createEmptyObject(), obj.loc);
            const newAssignments: ExpressionStatement[] = [];
            rightExpr.properties.forEach((prop) => {
                if (prop.type === "Property") {
                    const propKey = createIdentifierFromExpression(prop.key as Expression);
                    const propValue = prop.value as Expression;
                    if (propKey && propValue) {
                        newAssignments.push(createPropertyAssignment(id, propKey, propValue, obj.loc));
                    }
                }
            });
            newObj.right = id;
            const stmts = [...children[1].stmts, decl, ...newAssignments]
            return { stmts, expr: newObj }
        } else if (rightExpr.type === "FunctionExpression" || rightExpr.type === "ArrowFunctionExpression") {
            let functionIdentifier;
            if (rightExpr.type === "FunctionExpression" && rightExpr.id) {
                // create variable with the same name as function
                functionIdentifier = createIdentifierWithName(rightExpr.id.name);
            } else {
                // create new random identifier
                functionIdentifier = createRandomIdentifier();
            }

            const newRightExpr = copyObj(rightExpr);
            delete newRightExpr.id;
            const decl = createVariableDeclarationWithIdentifier(functionIdentifier, newRightExpr, obj.loc).decl;

            newObj.right = functionIdentifier;

            return {
                stmts: [...children[0].stmts, ...children[1].stmts, decl],
                expr: newObj
            };
        } else if (rightExpr.type === "ConditionalExpression") {
            const stmts = [...children[0].stmts, ...children[1].stmts];
            if (parent && (parent.type === "IfStatement" || parent.type === "SequenceExpression" || parent.type === "CallExpression")) {
                return { stmts, expr: leftExpr }
            } else return { stmts, expr: null };
        } else if (rightExpr.type === "CallExpression") {
            if (leftExpr.type !== "Identifier") {
                // create new random identifier
                const newIdentifier = createRandomIdentifier()
                const newRightExpr = copyObj(rightExpr);

                const decl = createVariableDeclarationWithIdentifier(newIdentifier, newRightExpr, obj.loc).decl;

                newObj.right = newIdentifier;

                return {
                    stmts: [...children[1].stmts, decl],
                    expr: newObj
                };
            } else {
                newObj.right = rightExpr;

                return {
                    stmts: [...children[1].stmts],
                    expr: newObj
                };
            }
        } else if (rightExpr.type === "AssignmentExpression") {
            const newIdentifier = createRandomIdentifier()
            const newRightExpr = copyObj(rightExpr.left);

            const decl = createVariableDeclarationWithIdentifier(newIdentifier, newRightExpr, obj.loc).decl;
            newObj.right = newIdentifier;

            return {
                stmts: [...children[0].stmts, ...children[1].stmts, decl],
                expr: newObj
            };
        } else if (rightExpr.type === "MemberExpression" && leftExpr.type === "MemberExpression") {
            const newIdentifier = createRandomIdentifier()

            const decl = createVariableDeclarationWithIdentifier(newIdentifier, rightExpr, obj.loc).decl;
            newObj.right = newIdentifier;

            return {
                stmts: [...children[0].stmts, ...children[1].stmts, decl],
                expr: newObj
            };
        }
        newObj.right = rightExpr;
        return {
            stmts: [...children[0].stmts, ...children[1].stmts, ...assignmentStatement],
            expr: assignmentValue ?? newObj
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
            expr: null
        };
    }

    return {
        stmts: [...flatStmts(children)],
        expr: null
    };
}

export function normUpdateExpression(obj: UpdateExpression | UnaryExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const argument = children[0].expr;

    // if the argument was not normalization we just ignore
    if (argument) {
        newObj.argument = argument;

        const { id, decl } = createVariableDeclaration(newObj, obj.loc);

        return {
            stmts: [...children[0].stmts, decl],
            expr: id
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
        const funcIdentifier: Identifier = funcId.expr as Identifier;
        newObj.id = null;

        const decl = createVariableDeclarationWithIdentifier(funcIdentifier, newObj, obj.loc).decl;

        return {
            stmts: [decl],
            expr: null
        };
    }

    const decl = createVariableDeclaration(newObj, obj.loc).decl;

    return {
        stmts: [decl],
        expr: null
    };
}

export function normLabeledStatement(obj: LabeledStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.id = children[0].expr;

    newObj.body = createBlockStatement(children[1].stmts as Statement[]);

    return {
        stmts: [newObj],
        expr: null
    };
}

export function normReturnStatement(obj: ReturnStatement | ThrowStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    // check if there are any arguments
    if (children[0]) {
        newObj.argument = children[0].expr;

        return {
            stmts: [...children[0].stmts, newObj],
            expr: null
        };
    }

    return {
        stmts: [newObj],
        expr: null
    };
}

export function normFunctionExpression(obj: FunctionExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    const stmts: Node[] = [];

    if (children[0]) {
        newObj.id = children[0].expr;
    }

    [newObj.body] = children[1].stmts;

    if (parent &&
        (parent.type === "VariableDeclarator" ||
            parent.type === "ExpressionStatement" ||
            parent.type === "AssignmentExpression" ||
            parent.type === "MethodDefinition" ||
            (parent.type === "Property" && (parent.kind === "set" || parent.kind === "get")))) {
        return {
            stmts: [],
            expr: newObj
        };
    }

    const { id, decl } = createVariableDeclaration(newObj, obj.loc);
    stmts.push(decl);

    return {
        stmts,
        expr: id
    };
}

export function createArrowFunctionBlockBody(body: Expression): BlockStatement {
    const newReturnStatement: ReturnStatement = { type: "ReturnStatement", argument: body }
    return { type: "BlockStatement", body: [newReturnStatement] }
}

export function normArrowFunctionExpression(obj: ArrowFunctionExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    // newObj.type = "FunctionExpression";
    let stmts: Node[] = [];

    if (children[0].expr) { // body is an expression
        newObj.body = children[0].expr;
        stmts = children[0].stmts;
    } else { // body is a block statement
        [newObj.body] = children[0].stmts;
    }

    if (parent &&
        (parent.type === "VariableDeclarator" ||
            parent.type === "ExpressionStatement" ||
            parent.type === "AssignmentExpression")) {
        return {
            stmts,
            expr: newObj
        };
    }

    const { id, decl } = createVariableDeclaration(newObj, obj.loc);
    stmts.push(decl);

    return {
        stmts,
        expr: id
    };
}

export function normCallExpression(obj: CallExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    const callee = children[0].expr;
    const stmts: Node[] = [];
    newObj.callee = callee;
    newObj.arguments = flatExprs(children.slice(1));

    if (parent &&
        ((parent.type === "VariableDeclarator" && parent.id.type !== "ArrayPattern") ||
            parent.type === "AssignmentExpression" ||
            parent.type === "AwaitExpression")) {
        return {
            stmts: [...flatStmts(children), ...stmts],
            expr: newObj
        };
    }

    const { id, decl } = createVariableDeclaration(newObj, obj.loc);

    return {
        stmts: [...flatStmts(children), ...stmts, decl],
        expr: id
    };
}

export function normMemberExpression(obj: MemberExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.property = children[1].expr;

    if (parent &&
        (parent.type === "VariableDeclarator" ||
            // || parent.type === "ExpressionStatement"
            (parent.type === "NewExpression" && parent.callee === obj) ||
            (parent.type === "CallExpression" && parent.callee === obj) ||
            parent.type === "AssignmentExpression")) {
        return {
            stmts: [...children[0].stmts, ...children[1].stmts],
            expr: newObj
        };
    }

    const { id, decl } = createVariableDeclaration(newObj, obj.loc);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, decl],
        expr: id
    };
}

export function normObjectExpression(obj: ObjectExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.properties = [...flatExprs(children)];

    if (parent &&
        (parent.type === "VariableDeclarator" ||
            parent.type === "ExpressionStatement" ||
            (parent.type === "AssignmentExpression" && parent.left.type !== "MemberExpression"))) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj
        };
    }

    if (parent?.type === "Property" || (parent?.type === "AssignmentExpression" && parent.left.type === "MemberExpression")) {
        const { id, decl } = createVariableDeclaration(createEmptyObject(), obj.loc);
        const newAssignments: ExpressionStatement[] = [];
        // push declarations for each property using accesses to new variable
        newObj.properties.forEach((prop: Property) => {
            if (prop.type === "Property") {
                const propKey = prop.key.type === "Identifier" || prop.key.type === "Literal" ? prop.key : null;
                const propValue = prop.value as Expression;
                if (propKey && propValue) {
                    newAssignments.push(createPropertyAssignment(id, propKey, propValue, obj.loc));
                }
            }
        });

        return {
            stmts: [...flatStmts(children), decl, ...newAssignments],
            expr: id
        };
    }

    const { id, decl } = createVariableDeclaration(newObj, obj.loc);
    const stmts = flatStmts(children);
    return {
        stmts: [...stmts, decl],
        expr: id
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
        const { id, decl } = createVariableDeclaration(keyExpr as Expression, obj.loc);
        newObj.key = id;
        keyStmts.push(decl);
    } else {
        newObj.key = keyExpr;
    }

    const valueExpr = normalizedValue.expr;
    if (valueExpr && isNotLiteral(valueExpr) && isNotEmpty(valueExpr) && isNotPropertyMethod(obj)) {
        const { id, decl } = createVariableDeclaration(valueExpr as Expression, obj.loc);
        newObj.value = id;
        valueStmts.push(decl);
    } else {
        newObj.value = valueExpr;
        newObj.method = false;
    }

    return {
        stmts: [...keyStmts, ...valueStmts],
        expr: newObj
    };
}

export function normArrayExpression(obj: ArrayExpression, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.elements = [...flatExprs(children)];

    if ((parent && (parent.type === "ExpressionStatement" || parent.type === "VariableDeclarator" || parent.type === "AssignmentExpression")) ?? !isNotEmpty(obj)) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj
        };
    } else {
        const { id, decl } = createVariableDeclaration(newObj, obj.loc);
        return {
            stmts: [...flatStmts(children), decl],
            expr: id
        };
    }
}

export function normArrayPattern(obj: ArrayPattern, children: Normalization[], parent: Node | null): Normalization {
    const newObj = copyObj(obj);
    newObj.elements = [...flatExprs(children)];

    if ((parent && (parent.type === "ExpressionStatement" || parent.type === "VariableDeclarator" || parent.type === "AssignmentExpression")) ?? !isNotEmpty(obj)) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj
        };
    } else {
        const { id, decl } = createVariableDeclaration(newObj, obj.loc);
        return {
            stmts: [...flatStmts(children), decl],
            expr: id
        };
    }
}

// AssignmentPattern can have an expression of the right side. We need to normalize the expression and add the statements on top
// children[0] is left element
// children[1] is the right element
export function normAssignmentPattern(obj: AssignmentPattern, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.left = children[0].expr;
    newObj.right = children[1].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts],
        expr: newObj
    };
}

export function normClassExpression(obj: ClassExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const classBodyNormalization = children[2];

    if (classBodyNormalization.expr) {
        newObj.body = classBodyNormalization.expr;
    }

    return {
        stmts: [],
        expr: newObj
    };
}

// https://stackoverflow.com/questions/8242697/javascript-functions-to-simulate-classes-best-practices
export function normClassDeclaration(obj: ClassDeclaration, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const stmts: any = [];

    const id: Identifier = newObj.id;
    // const superClass = children[1];
    const classBodyNormalization = children[2];

    const funcExpr = createEmptyFunctionExpression(id, obj.loc);
    let funcDecl = createVariableDeclarationWithIdentifier(id, funcExpr, obj.loc, true);

    if (classBodyNormalization.expr) {
        const classBody = classBodyNormalization.expr as ClassBody;
        const methods = classBody.body;
        methods.forEach(method => {
            const key = method.key as Identifier;
            if (key.name === "constructor") {
                const constructorMethod = method.value as FunctionExpression;
                constructorMethod.id = id;
                funcDecl = createVariableDeclarationWithIdentifier(id, constructorMethod, obj.loc, true);
            } else {
                const newMethod = createVariableDeclarationWithIdentifier(key, method.value, obj.loc, true);
                stmts.push(newMethod.decl);
                const newAssignment = createPropertyAssignment(id, key, newMethod.id, obj.loc);
                stmts.push(newAssignment);
            }
        });
    }

    return {
        stmts: [funcDecl.decl, ...stmts],
        expr: null
    };
}

export function normClassBody(obj: ClassBody, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.body = [...flatExprs(children)];

    return {
        stmts: [],
        expr: newObj
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
        expr: newObj
    };
}

export function normAwaitYieldExpression(obj: AwaitExpression | YieldExpression | SpreadElement | RestElement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    const [argumentNormalization] = children;

    if (argumentNormalization.expr) {
        newObj.argument = argumentNormalization.expr;
    }

    return {
        stmts: [...flatStmts(children)],
        expr: newObj
    };
}

export function normSequenceExpression(obj: SequenceExpression, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.expressions = [...flatExprs(children)];

    return {
        stmts: [...flatStmts(children)],
        expr: newObj
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
        expr: null
    };
}

export function normCatchClause(obj: CatchClause, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.param = children[0].expr;
    newObj.body = children[1].stmts[0];

    return {
        stmts: [...children[0].stmts],
        expr: newObj
    };
}

export function normWithStatement(obj: WithStatement, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.body = children[1].stmts[0];

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null
    };
}

export function normExportDeclaration(obj: ExportDefaultDeclaration | ExportNamedDeclaration, children: Normalization[]): Normalization {
    const newObj = copyObj(obj);

    if (children[0].expr) {
        newObj.declaration = children[0].expr;
        return {
            stmts: [...children[0].stmts, newObj],
            expr: null
        };
    }

    newObj.declaration = children[0].stmts[0];

    return {
        stmts: [newObj],
        expr: null
    };
}
