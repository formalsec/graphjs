/* eslint-disable no-undef */
const esprima = require("esprima");
const escodegen = require("escodegen");

const { resetVariableCount } = require("../utils/utils");
const {
    createVariableDeclaration,
    flatStmts,
    flatExprs,
    normProgram,
    normBinaryExpression,
    normVariableDeclaration,
    normVariableDeclarator,
    normBlockStatement,
    normIfStatement,
    normConditionalExpression,
    normWhileStatement,
    normAssignmentExpressions,
    normExpressionStatement,
    normUpdateExpression,
    normFunctionDeclaration,
    normReturnStatement,
    normFunctionExpression,
    normCallExpression,
    normMemberExpression,
    normObjectExpression,
    normProperty,
    normalize,
} = require("./normalizer");

test("create a new variable statement", () => {
    const variableName = "v1";
    const variableId = {
        type: "Identifier",
        name: variableName,
    };

    const oldObject = {};

    const expectedReturn = {
        varObj: variableId,
        newStmt: {
            type: "VariableDeclaration",
            declarations: [
                {
                    type: "VariableDeclarator",
                    id: variableId,
                    init: oldObject,
                },
            ],
            kind: "const",
        },
    };

    expect(createVariableDeclaration(oldObject, variableName)).toMatchObject(expectedReturn);
});

test("flat statements of children array", () => {
    const children = [{ stmts: [1, 2, 3] }, { stmts: [4, 5, 6] }];
    expect(flatStmts(children)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("flat expressions of children array", () => {
    const children = [{ expr: 1 }, { expr: 2 }, { expr: 3 }, { expr: 4 }];
    expect(flatExprs(children)).toEqual([1, 2, 3, 4]);
});

test("normalize Program", () => {
    const stmtExample = (n) => ({ hello: `world ${n}` });
    const childrenExample = (n) => ({ stmts: [stmtExample(n)], expr: null });

    const originalProg = {
        type: "Program",
        sourceType: "script",
        body: [childrenExample(1), childrenExample(2)],
    };

    // placeholder for normalized children
    const children = [childrenExample(3), childrenExample(4)];
    const expectedProg = {
        type: "Program",
        sourceType: "script",
        body: [stmtExample(3), stmtExample(4)],
    };

    expect(normProgram(originalProg, children)).toMatchObject({
        stmts: [expectedProg],
        expr: null,
    });

    expect(normProgram(originalProg, children)).not.toBe({
        stmts: [expectedProg],
        expr: null,
    });
});

test("normalize BinaryExpression", () => {
    const exprExample = (n) => ({ hello: `world ${n}` });
    const childrenExample = (n) => ({ stmts: [n], expr: exprExample(n) });

    const originalBinaryExpr = {
        type: "BinaryExpression",
        operator: "+",
        left: exprExample(1),
        right: exprExample(2),
    };

    const children = [childrenExample(3), childrenExample(4)];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    const newStmt = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: variableObj,
                init: {
                    type: "BinaryExpression",
                    operator: "+",
                    left: exprExample(3),
                    right: exprExample(4),
                },
            },
        ],
        kind: "const",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normBinaryExpression(originalBinaryExpr, children)).toMatchObject({
        stmts: [3, 4, newStmt],
        expr: variableObj,
    });
});

test("normalize LogicalExpression", () => {
    const exprExample = (n) => ({ hello: `world ${n}` });
    const childrenExample = (n) => ({ stmts: [n], expr: exprExample(n) });

    const originalBinaryExpr = {
        type: "LogicalExpression",
        operator: "&&",
        left: exprExample(1),
        right: exprExample(2),
    };

    const children = [childrenExample(3), childrenExample(4)];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    const newStmt = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: variableObj,
                init: {
                    type: "LogicalExpression",
                    operator: "&&",
                    left: exprExample(3),
                    right: exprExample(4),
                },
            },
        ],
        kind: "const",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normBinaryExpression(originalBinaryExpr, children)).toMatchObject({
        stmts: [3, 4, newStmt],
        expr: variableObj,
    });
});

test("normalize VariableDeclaration", () => {
    const createVariable = (n) => ({ variable: `v${n}` });
    const childrenExample = (n) => ({ stmts: [n], expr: createVariable(n) });
    const createDeclaration = (n) => ({
        type: "VariableDeclaration",
        declarations: [createVariable(n)],
        kind: "const",
    });

    const originalStmt = {
        type: "VariableDeclaration",
        declarations: [
            createVariable(0),
            createVariable(1),
            createVariable(2),
        ],
        kind: "const",
    };

    const children = [childrenExample(3), childrenExample(4), childrenExample(5)];

    expect(normVariableDeclaration(originalStmt, children)).toMatchObject({
        stmts: [
            3, 4, 5,
            createDeclaration(3),
            createDeclaration(4),
            createDeclaration(5),
        ],
        expr: null,
    });
});

test("normalize VariableDeclarator (1) without binary expression", () => {
    const createVariable = (n) => ({ variable: `v${n}` });
    const childrenExample = (n) => ({ stmts: [n], expr: createVariable(n) });

    const idObj = { type: "Identifier", name: "v1" };
    const originalObj = {
        type: "VariableDeclarator",
        id: idObj,
        init: createVariable(0),
    };

    children = [{ stmts: [], expr: idObj }, childrenExample(1)];

    expect(normVariableDeclarator(originalObj, children)).toMatchObject({
        stmts: [1],
        expr: {
            type: "VariableDeclarator",
            id: idObj,
            init: createVariable(1),
        },
    });
});

test("normalize VariableDeclarator (2) with binary expression", () => {
    const createVariable = (name) => ({ type: "Identifier", name });
    const childrenExample = (name) => ({ stmts: [name], expr: createVariable(name) });

    const idObj = { type: "Identifier", name: "v1" };
    const originalObj = {
        type: "VariableDeclarator",
        id: idObj,
        init: createVariable("x"),
    };

    children = [{ stmts: [], expr: idObj }, childrenExample("x")];

    expect(normVariableDeclarator(originalObj, children)).toMatchObject({
        stmts: ["x"],
        expr: {
            type: "VariableDeclarator",
            id: idObj,
            init: createVariable("x"),
        },
    });
});

test("normalize BlockStatement", () => {
    const createVariable = (name) => ({ type: "Identifier", name });
    const childrenExample = (name) => ({ stmts: [createVariable(name)], expr: null });

    const originalObj = {
        type: "BlockStatement",
        body: [createVariable("x"), createVariable("y")],
    };

    const children = [childrenExample("x_"), childrenExample("y_")];

    expect(normBlockStatement(originalObj, children)).toMatchObject({
        stmts: [
            {
                type: "BlockStatement",
                body: [createVariable("x_"), createVariable("y_")],
            },
        ],
        expr: null,
    });
});

test("normalize IfStatement (1) without alternate", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "IfStatement",
        test: createTestingObj("expr"),
        consequent: createTestingObj("stmt"),
    };

    const children = [childExpr("expr_"), childStmt("stmt_")];

    expect(normIfStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "IfStatement",
                test: createTestingObj("expr_"),
                consequent: createTestingObj("stmt_"),
            },
        ],
        expr: null,
    });
});

test("normalize IfStatement (2) with alternate", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "IfStatement",
        test: createTestingObj("expr"),
        consequent: createTestingObj("stmt_1"),
        alternate: createTestingObj("stmt_2"),
    };

    const children = [childExpr("expr_"), childStmt("stmt_1_"), childStmt("stmt_2_")];

    expect(normIfStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "IfStatement",
                test: createTestingObj("expr_"),
                consequent: createTestingObj("stmt_1_"),
                alternate: createTestingObj("stmt_2_"),
            },
        ],
        expr: null,
    });
});

test("normalize ConditionalExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ConditionalExpression",
        test: createTestingObj("expr_1"),
        consequent: createTestingObj("expr_2"),
        alternate: createTestingObj("expr_3"),
    };

    const children = [childExpr("expr_1_"), childExpr("expr_2_"), childExpr("expr_3_")];

    expect(normConditionalExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            "expr_2_",
            "expr_3_",
        ],
        expr: {
            type: "ConditionalExpression",
            test: createTestingObj("expr_1_"),
            consequent: createTestingObj("expr_2_"),
            alternate: createTestingObj("expr_3_"),
        },
    });
});

test("normalize WhileStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "WhileStatement",
        test: createTestingObj("expr_1"),
        body: createTestingObj("stmt_1"),
    };

    const children = [childExpr("expr_1_"), childStmt("stmt_1_")];

    expect(normWhileStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            {
                type: "WhileStatement",
                test: createTestingObj("expr_1_"),
                body: createTestingObj("stmt_1_"),
            },
        ],
        expr: null,
    });
});

test("normalize DoWhileStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "DoWhileStatement",
        test: createTestingObj("expr_1"),
        body: createTestingObj("stmt_1"),
    };

    const children = [childExpr("expr_1_"), childStmt("stmt_1_")];

    expect(normWhileStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            {
                type: "DoWhileStatement",
                test: createTestingObj("expr_1_"),
                body: createTestingObj("stmt_1_"),
            },
        ],
        expr: null,
    });
});

test("normalize AssignmentExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "AssignmentExpression",
        operator: "=",
        left: createTestingObj("expr_1"),
        right: createTestingObj("expr_2"),
    };

    const children = [childExpr("expr_1_"), childExpr("expr_2_")];

    expect(normAssignmentExpressions(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            "expr_2_",
        ],
        expr: {
            type: "AssignmentExpression",
            operator: "=",
            left: createTestingObj("expr_1_"),
            right: createTestingObj("expr_2_"),
        },
    });
});

test("normalize ExpressionStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ExpressionStatement",
        expression: createTestingObj("expr"),
    };

    const children = [childExpr("expr_")];

    expect(normExpressionStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "ExpressionStatement",
                expression: createTestingObj("expr_"),
            },
        ],
        expr: null,
    });
});

test("normalize UpdateExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "UpdateExpression",
        operator: "++",
        argument: createTestingObj("expr"),
        prefix: true,
    };

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    const children = [childExpr("expr_")];

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normUpdateExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "UpdateExpression",
                            operator: "++",
                            argument: createTestingObj("expr_"),
                            prefix: true,
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize UnaryExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "UnaryExpression",
        operator: "!",
        argument: createTestingObj("expr"),
        prefix: true,
    };

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    const children = [childExpr("expr_")];

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normUpdateExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "UnaryExpression",
                            operator: "!",
                            argument: createTestingObj("expr_"),
                            prefix: true,
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize FunctionDeclaration", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "FunctionDeclaration",
        id: createTestingObj("foo"),
        params: [],
        body: createTestingObj("stmt"),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [childExpr("foo_"), childStmt("stmt_")];

    expect(normFunctionDeclaration(originalObj, children)).toMatchObject({
        stmts: [
            {
                type: "FunctionDeclaration",
                id: createTestingObj("foo_"),
                params: [],
                body: createTestingObj("stmt_"),
                generator: false,
                async: false,
                expression: false,
            },
        ],
        expr: null,
    });
});

test("normalize ReturnStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ReturnStatement",
        argument: createTestingObj("expr"),
    };

    const children = [childExpr("expr_")];

    expect(normReturnStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "ReturnStatement",
                argument: createTestingObj("expr_"),
            },
        ],
        expr: null,
    });
});

test("normalize ThrowStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ThrowStatement",
        argument: createTestingObj("expr"),
    };

    const children = [childExpr("expr_")];

    expect(normReturnStatement(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "ThrowStatement",
                argument: createTestingObj("expr_"),
            },
        ],
        expr: null,
    });
});

test("normalize FunctionExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "FunctionExpression",
        id: createTestingObj("foo"),
        params: [],
        body: createTestingObj("stmt"),
        generator: false,
        async: false,
        expression: true,
    };

    const children = [childExpr("foo_"), childStmt("stmt_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normFunctionExpression(originalObj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "FunctionExpression",
                            id: createTestingObj("foo_"),
                            params: [],
                            body: createTestingObj("stmt_"),
                            generator: false,
                            async: false,
                            expression: true,
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize ArrowFunctionExpression (1) with BlockStatement", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const originalObj = {
        type: "ArrowFunctionExpression",
        id: createTestingObj("foo"),
        params: [],
        body: createTestingObj("stmt"),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [childExpr("foo_"), childStmt("stmt_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normFunctionExpression(originalObj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "ArrowFunctionExpression",
                            id: createTestingObj("foo_"),
                            params: [],
                            body: createTestingObj("stmt_"),
                            generator: false,
                            async: false,
                            expression: false,
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize ArrowFunctionExpression (2) with Expression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ArrowFunctionExpression",
        id: createTestingObj("foo"),
        params: [],
        body: createTestingObj("expr"),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [childExpr("foo_"), childExpr("expr_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normFunctionExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "ArrowFunctionExpression",
                            id: createTestingObj("foo_"),
                            params: [],
                            body: createTestingObj("expr_"),
                            generator: false,
                            async: false,
                            expression: false,
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize CallExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "CallExpression",
        callee: createTestingObj("callee"),
        arguments: [createTestingObj("expr_1"), createTestingObj("expr_2")],
    };

    const children = [childExpr("callee_"), childExpr("expr_1_"), childExpr("expr_2_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normCallExpression(originalObj, children)).toMatchObject({
        stmts: [
            "callee_",
            "expr_1_",
            "expr_2_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "CallExpression",
                            callee: createTestingObj("callee_"),
                            arguments: [createTestingObj("expr_1_"), createTestingObj("expr_2_")],
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize MemberExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "MemberExpression",
        computed: false,
        object: createTestingObj("expr_1"),
        property: createTestingObj("expr_2"),
    };

    const children = [childExpr("expr_1_"), childExpr("expr_2_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normMemberExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            "expr_2_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "MemberExpression",
                            computed: false,
                            object: createTestingObj("expr_1_"),
                            property: createTestingObj("expr_2_"),
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize ObjectExpression", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "ObjectExpression",
        properties: [
            createTestingObj("expr_1"),
            createTestingObj("expr_2"),
        ],
    };

    const children = [childExpr("expr_1_"), childExpr("expr_2_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normObjectExpression(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            "expr_2_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: {
                            type: "ObjectExpression",
                            properties: [
                                createTestingObj("expr_1_"),
                                createTestingObj("expr_2_"),
                            ],
                        },
                    },
                ],
                kind: "const",
            },
        ],
        expr: variableObj,
    });
});

test("normalize Property with Identifier key and Literal value", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "Property",
        key: createTestingObj("expr_1"),
        computed: false,
        value: createTestingObj("expr_2"),
        kind: "init",
        method: false,
        shorthand: false,
    };

    const children = [childExpr("expr_1_"), childExpr("expr_2_")];

    expect(normProperty(originalObj, children)).toMatchObject({
        stmts: ["expr_1_", "expr_2_"],
        expr: {
            type: "Property",
            key: createTestingObj("expr_1_"),
            computed: false,
            value: createTestingObj("expr_2_"),
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});

test("normalize Property with Identifier key and Expression value", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "Property",
        key: createTestingObj("expr_1"),
        computed: false,
        value: { type: "RandomTestingType" },
        kind: "init",
        method: false,
        shorthand: false,
    };

    const child2 = {
        stmts: [],
        expr: { type: "RandomTestingType" },
    };

    const children = [childExpr("expr_1_"), child2];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normProperty(originalObj, children)).toMatchObject({
        stmts: [
            "expr_1_",
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: { type: "RandomTestingType" },
                    },
                ],
                kind: "const",
            },
        ],
        expr: {
            type: "Property",
            key: createTestingObj("expr_1_"),
            computed: false,
            value: variableObj,
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});

test("normalize Property with Expression key and Literal value", () => {
    const createTestingObj = (name) => ({ type: "Identifier", name });
    const childExpr = (name) => ({ stmts: [name], expr: createTestingObj(name) });

    const originalObj = {
        type: "Property",
        key: { type: "RandomTestingType" },
        computed: false,
        value: createTestingObj("expr_2"),
        kind: "init",
        method: false,
        shorthand: false,
    };

    const child1 = {
        stmts: [],
        expr: { type: "RandomTestingType" },
    };

    const children = [child1, childExpr("expr_2_")];

    const variableObj = {
        type: "Identifier",
        name: "v1",
    };

    resetVariableCount(); // setting this to make sure next variable name is v1
    expect(normProperty(originalObj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variableObj,
                        init: { type: "RandomTestingType" },
                    },
                ],
                kind: "const",
            },
            "expr_2_",
        ],
        expr: {
            type: "Property",
            key: variableObj,
            computed: false,
            value: createTestingObj("expr_2_"),
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});

// COMPLETE NORMALIZATIONS

function testNormalization(code) {
    const ast = esprima.parse(code);
    const newAst = normalize(ast).stmts[0];
    const newCode = escodegen.generate(newAst);

    // eslint-disable-next-line no-eval
    expect(eval(newCode)).toEqual(eval(code));
}

test("testing normalize - check that normalization retains same behaviour (1) - binary expression", () => {
    const code = "1 + 2";
    testNormalization(code);
});

test("testing normalize - check that normalization retains same behaviour (2) - assignment", () => {
    const code = "let x; x = 1";
    testNormalization(code);
});

test("testing normalize - check that normalization retains same behaviour (3) - conditionals", () => {
    const code1 = "let status = (true) ? 'adult' : 'minor';";
    testNormalization(code1);

    const code2 = "let x = 6;let status = (x === 6) ? 1 + 2 : 1 + 2 + 3;";
    testNormalization(code2);
});

test("testing normalize - check that normalization retains same behaviour (4) - variable declarations", () => {
    const code1 = "let x = 1;";
    testNormalization(code1);

    const code2 = "let x = 1 + 2;";
    testNormalization(code2);

    const code3 = "let x = 1 + 2 + 3;";
    testNormalization(code3);

    const code4 = "let x = 1 + 2, y = 3;";
    testNormalization(code4);
});

test("testing normalize - check that normalization retains same behaviour (5) - function declarations", () => {
    const code1 = "function f1() {let x = 0;}";
    testNormalization(code1);

    const code2 = "function f2(x, y, z) {x++;}";
    testNormalization(code2);

    const code3 = "function f3() {let x = 1 + 2 + 3;return x;}";
    testNormalization(code3);

    const code4 = "function f4() {throw x;}";
    testNormalization(code4);
});

test("testing normalize - check that normalization retains same behaviour (6) - function expressions", () => {
    const code1 = "let z = function() {1+1;};";
    testNormalization(code1);

    const code2 = "let x = (z) => 1+2+3;";
    testNormalization(code2);
});

test("testing normalize - check that normalization retains same behaviour (7) - if statements", () => {
    const code1 = "if (true) {1;}";
    testNormalization(code1);

    const code2 = "let x = 1 + 2 + 3; if(x) {let y = 1 + 2 + 3;}";
    testNormalization(code2);

    const code3 = "let x = 1 + 2 + 3; if (x) {let y = 1 + 2 + 3;} else {let z = 1 + 2 + 3;}";
    testNormalization(code3);

    const code4 = "let x = 1 + 2 + 3; if (x === 6) {let y = 1 + 2 + 3;} else {let z = 1 + 2 + 3;}";
    testNormalization(code4);
});

test("testing normalize - check that normalization retains same behaviour (8) - unary expressions", () => {
    const code1 = "+false;";
    testNormalization(code1);

    const code2 = "!false;";
    testNormalization(code2);

    const code3 = "let x = 0;x++;";
    testNormalization(code3);
});

test("testing normalize - check that normalization retains same behaviour (8) - object expressions", () => {
    const code1 = "let x = {};";
    testNormalization(code1);

    const code2 = "let x = { p: \"p\" };";
    testNormalization(code2);
});

test("testing normalize - check that normalization retains same behaviour (8) - member expressions", () => {
    const code1 = "let x = {}; x.p = \"p\"";
    testNormalization(code1);

    const code2 = "let x = { p: \"p\" }; let y = x.p;";
    testNormalization(code2);
});

test("testing normalize - check that normalization retains same behaviour (8) - call and new expressions", () => {
    const code1 = "let x = eval(\"1+2\");";
    testNormalization(code1);

    const code2 = "let x = new Object();";
    testNormalization(code2);
});

test("testing normalize - check that normalization retains same behaviour (8) - do and dowhile statements", () => {
    const code1 = "while (false) { 1; }";
    testNormalization(code1);

    // const code2 = "let x = 0; while (x < 1) { x++; }";
    // testNormalization(code2);

    // const code3 = "let x = 0; do { x++ } while (x < 1);";
    // testNormalization(code3);
});
