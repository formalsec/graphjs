const { resetVariableCount } = require('../utils/utils');
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
} = require('./normalizer');

test('create a new variable statement', () => {
    const variable_name = "v0";
    const variable_id = {
        type: "Identifier",
        name: variable_name,
    };

    const old_object = {};
    const expected_stmt = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: variable_id,
                init: old_object,
            }
        ],
        kind: "let",
    };

    const expected_return = {
        var_obj: variable_id,
        new_stmt: expected_stmt,
    };

    expect(createVariableDeclaration(old_object, variable_name)).toMatchObject(expected_return);
});

test('flat statements of children array', () => {
    const children = [ { stmts: [1, 2, 3] }, { stmts: [4, 5, 6] } ];
    expect(flatStmts(children)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('flat expressions of children array', () => {
    const children = [ { expr: 1 }, { expr: 2 }, { expr: 3 }, { expr: 4 } ];
    expect(flatExprs(children)).toEqual([1, 2, 3, 4]);
});

test('normalize Program', () => {
    const stmtExample      = (n) => ({ hello: `world ${n}` });
    const childrenExample  = (n) => ({ stmts: [ stmtExample(n) ], expr: null });

    const original_prog = {
        type: 'Program',
        sourceType: 'script',
        body: [ childrenExample(1), childrenExample(2) ],
    };

    // placeholder for normalized children
    const children = [ childrenExample(3), childrenExample(4) ];
    const expected_prog = {
        type: 'Program',
        sourceType: 'script',
        body: [ stmtExample(3), stmtExample(4) ],
    };

    expect(normProgram(original_prog, children)).toMatchObject({
        stmts: [ expected_prog ],
        expr: null,
    });

    expect(normProgram(original_prog, children)).not.toBe({
        stmts: [ expected_prog ],
        expr: null,
    });
    
});

test('normalize BinaryExpression', () => {
    const exprExample      = (n) => ({ hello: `world ${n}` });
    const childrenExample  = (n) => ({ stmts: [ n ], expr: exprExample(n) });

    const original_binary_expr = {
        type: 'BinaryExpression',
        operator: '+',
        left: exprExample(1),
        right: exprExample(2),
    };

    const children = [ childrenExample(3), childrenExample(4) ];
    
    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    const new_stmt = {
        type: 'VariableDeclaration',
        declarations: [
            {
                type: 'VariableDeclarator',
                id: variable_obj,
                init: {
                    type: 'BinaryExpression',
                    operator: '+',
                    left: exprExample(3),
                    right: exprExample(4),
                },
            }
        ],
        kind: 'let',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normBinaryExpression(original_binary_expr, children)).toMatchObject({
        stmts: [3, 4, new_stmt],
        expr: variable_obj,
    });
});

test('normalize LogicalExpression', () => {
    const exprExample      = (n) => ({ hello: `world ${n}` });
    const childrenExample  = (n) => ({ stmts: [ n ], expr: exprExample(n) });

    const original_binary_expr = {
        type: 'LogicalExpression',
        operator: '&&',
        left: exprExample(1),
        right: exprExample(2),
    };

    const children = [ childrenExample(3), childrenExample(4) ];
    
    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    const new_stmt = {
        type: 'VariableDeclaration',
        declarations: [
            {
                type: 'VariableDeclarator',
                id: variable_obj,
                init: {
                    type: 'LogicalExpression',
                    operator: '&&',
                    left: exprExample(3),
                    right: exprExample(4),
                },
            }
        ],
        kind: 'let',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normBinaryExpression(original_binary_expr, children)).toMatchObject({
        stmts: [3, 4, new_stmt],
        expr: variable_obj,
    });
});

test('normalize VariableDeclaration', () => {
    const createVariable = (n) => ({ variable: `v${n}` });
    const childrenExample  = (n) => ({ stmts: [ n ], expr: createVariable(n) });
    const createDeclaration = (n) => ({
        type: 'VariableDeclaration',
        declarations: [ createVariable(n) ],
        kind: 'let',
    });

    const original_stmt = {
        type: 'VariableDeclaration',
        declarations: [
            createVariable(0),
            createVariable(1),
            createVariable(2),
        ],
        kind: 'let',
    };

    const children = [ childrenExample(3), childrenExample(4), childrenExample(5) ];

    expect(normVariableDeclaration(original_stmt, children)).toMatchObject({
        stmts: [
            3, 4, 5,
            createDeclaration(3),
            createDeclaration(4),
            createDeclaration(5)
        ],
        expr: null,
    });
});

test('normalize VariableDeclarator (1) without binary expression', () => {
    const createVariable = (n) => ({ variable: `v${n}` });
    const childrenExample  = (n) => ({ stmts: [n], expr: createVariable(n) });
    
    const id_obj = { type: 'Identifier', name: 'v0' };
    const original_obj = {
        type: 'VariableDeclarator',
        id: id_obj,
        init: createVariable(0),
    };

    children = [ { stmts: [], expr: id_obj }, childrenExample(1) ]

    expect(normVariableDeclarator(original_obj, children)).toMatchObject({
        stmts: [1],
        expr: {
            type: 'VariableDeclarator',
            id: id_obj,
            init: createVariable(1),
        }
    });
});

test('normalize VariableDeclarator (2) with binary expression', () => {
    const createVariable = (name) => ({ type: 'Identifier', name });
    const childrenExample  = (name) => ({ stmts: [name], expr: createVariable(name) });
    
    const id_obj = { type: 'Identifier', name: 'v0' };
    const original_obj = {
        type: 'VariableDeclarator',
        id: id_obj,
        init: createVariable('x'),
    };

    children = [ { stmts: [], expr: id_obj }, childrenExample('x') ]

    expect(normVariableDeclarator(original_obj, children)).toMatchObject({
        stmts: ['x'],
        expr: {
            type: 'VariableDeclarator',
            id: id_obj,
            init: createVariable('x'),
        }
    });
});

// test('normalize VariableDeclarator (3) with binary expression needing to normalize', () => {
//     const createVariable = (name) => ({ type: 'Identifier', name });
//     const createDeclaration = (name) => ({
//         type: 'VariableDeclaration',
//         declarations: [
//             {
//                 type: 'VariableDeclarator',
//                 id: createVariable(name),
//                 init: { hello: 'world' },
//             }
//         ],
//         kind: 'let',
//     });

//     const childrenExample  = (name) => ({
//         stmts: [createDeclaration(name)],
//         expr: createVariable(name)
//     });
    
//     const id_obj = createVariable('x');
//     const original_obj = {
//         type: 'VariableDeclarator',
//         id: id_obj,
//         init: createVariable('v0'),
//     };

//     children = [ { stmts: [], expr: id_obj }, childrenExample('v0') ]

//     expect(normVariableDeclarator(original_obj, children)).toMatchObject({
//         stmts: [],
//         expr: {
//             type: 'VariableDeclarator',
//             id: id_obj,
//             init: { hello: 'world' },
//         }
//     });
// });

test('normalize BlockStatement', () => {
    const createVariable = (name) => ({ type: 'Identifier', name });
    const childrenExample  = (name) => ({ stmts: [createVariable(name)], expr: null });

    const original_obj = {
        type: 'BlockStatement',
        body: [ createVariable('x'), createVariable('y') ],
    };

    const children = [ childrenExample('x_'), childrenExample('y_') ];

    expect(normBlockStatement(original_obj, children)).toMatchObject({
        stmts: [
            {
                type: 'BlockStatement',
                body: [ createVariable('x_'), createVariable('y_') ],
            }
        ],
        expr: null
    });
});

test('normalize IfStatement (1) without alternate', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'IfStatement',
        test: createTestingObj('expr'),
        consequent: createTestingObj('stmt')
    };

    const children = [ childExpr('expr_'), childStmt('stmt_') ];

    expect(normIfStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: 'IfStatement',
                test: createTestingObj('expr_'),
                consequent: createTestingObj('stmt_')
            }
        ],
        expr: null
    });
});

test('normalize IfStatement (2) with alternate', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'IfStatement',
        test: createTestingObj('expr'),
        consequent: createTestingObj('stmt_1'),
        alternate: createTestingObj('stmt_2')
    };

    const children = [ childExpr('expr_'), childStmt('stmt_1_'), childStmt('stmt_2_') ];

    expect(normIfStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: 'IfStatement',
                test: createTestingObj('expr_'),
                consequent: createTestingObj('stmt_1_'),
                alternate: createTestingObj('stmt_2_')
            }
        ],
        expr: null
    });
});

test('normalize ConditionalExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'ConditionalExpression',
        test: createTestingObj('expr_1'),
        consequent: createTestingObj('expr_2'),
        alternate: createTestingObj('expr_3')
    };

    const children = [ childExpr('expr_1_'), childExpr('expr_2_'), childExpr('expr_3_') ];

    expect(normConditionalExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            'expr_2_',
            'expr_3_',
        ],
        expr: {
            type: 'ConditionalExpression',
            test: createTestingObj('expr_1_'),
            consequent: createTestingObj('expr_2_'),
            alternate: createTestingObj('expr_3_')
        }
    });
});

test('normalize WhileStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'WhileStatement',
        test: createTestingObj('expr_1'),
        body: createTestingObj('stmt_1'),
    };

    const children = [ childExpr('expr_1_'), childStmt('stmt_1_') ];

    expect(normWhileStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            {
                type: 'WhileStatement',
                test: createTestingObj('expr_1_'),
                body: createTestingObj('stmt_1_'),
            }
        ],
        expr: null
    });
});

test('normalize DoWhileStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'DoWhileStatement',
        test: createTestingObj('expr_1'),
        body: createTestingObj('stmt_1'),
    };

    const children = [ childExpr('expr_1_'), childStmt('stmt_1_') ];

    expect(normWhileStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            {
                type: 'DoWhileStatement',
                test: createTestingObj('expr_1_'),
                body: createTestingObj('stmt_1_'),
            }
        ],
        expr: null
    });
});

test('normalize AssignmentExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'AssignmentExpression',
        operator: '=',
        left: createTestingObj('expr_1'),
        right: createTestingObj('expr_2'),
    };

    const children = [ childExpr('expr_1_'), childExpr('expr_2_') ];

    expect(normAssignmentExpressions(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            'expr_2_',
        ],
        expr: {
            type: 'AssignmentExpression',
            operator: '=',
            left: createTestingObj('expr_1_'),
            right: createTestingObj('expr_2_'),
        }
    });
});

test('normalize ExpressionStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'ExpressionStatement',
        expression: createTestingObj('expr'),
    };

    const children = [ childExpr('expr_') ];

    expect(normExpressionStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: 'ExpressionStatement',
                expression: createTestingObj('expr_'),
            }
        ],
        expr: null
    });
});

test('normalize UpdateExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'UpdateExpression',
        operator: '++',
        argument: createTestingObj('expr'),
        prefix: true,
    };

    const variable_obj = {
        type: "Identifier",
        name: "v0"
    };

    const children = [ childExpr('expr_') ];

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normUpdateExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: 'UpdateExpression',
                            operator: '++',
                            argument: createTestingObj('expr_'),
                            prefix: true,
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj,
    });
});

test('normalize UnaryExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "UnaryExpression",
        operator: "!",
        argument: createTestingObj('expr'),
        prefix: true,
    };

    const variable_obj = {
        type: "Identifier",
        name: "v0"
    };

    const children = [ childExpr('expr_') ];

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normUpdateExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: "UnaryExpression",
                            operator: "!",
                            argument: createTestingObj('expr_'),
                            prefix: true,
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj,
    });
});

test('normalize FunctionDeclaration', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'FunctionDeclaration',
        id: createTestingObj('foo'),
        params: [],
        body: createTestingObj('stmt'),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [ childExpr('foo_'), childStmt('stmt_') ];

    expect(normFunctionDeclaration(original_obj, children)).toMatchObject({
        stmts: [
            {
                type: 'FunctionDeclaration',
                id: createTestingObj('foo_'),
                params: [],
                body: createTestingObj('stmt_'),
                generator: false,
                async: false,
                expression: false,
            }
        ],
        expr: null
    });
});


test('normalize ReturnStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'ReturnStatement',
        argument: createTestingObj('expr') ,
    };

    const children = [ childExpr('expr_') ];

    expect(normReturnStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: 'ReturnStatement',
                argument: createTestingObj('expr_') ,
            }
        ],
        expr: null
    });
});

test('normalize ThrowStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'ThrowStatement',
        argument: createTestingObj('expr') ,
    };

    const children = [ childExpr('expr_') ];

    expect(normReturnStatement(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: 'ThrowStatement',
                argument: createTestingObj('expr_') ,
            }
        ],
        expr: null
    });
});

test('normalize FunctionExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'FunctionExpression',
        id: createTestingObj('foo'),
        params: [],
        body: createTestingObj('stmt'),
        generator: false,
        async: false,
        expression: true,
    };

    const children = [ childExpr('foo_'), childStmt('stmt_') ];

    const variable_obj = {
        type: "Identifier",
        name: "v0"
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normFunctionExpression(original_obj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: 'FunctionExpression',
                            id: createTestingObj('foo_'),
                            params: [],
                            body: createTestingObj('stmt_'),
                            generator: false,
                            async: false,
                            expression: true,
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj, 
    });
});

test('normalize ArrowFunctionExpression (1) with BlockStatement', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });
    const childStmt = (name) => ({ stmts: [createTestingObj(name)], expr: null });

    const original_obj = {
        type: 'ArrowFunctionExpression',
        id: createTestingObj('foo'),
        params: [],
        body: createTestingObj('stmt'),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [ childExpr('foo_'), childStmt('stmt_') ];

    const variable_obj = {
        type: "Identifier",
        name: "v0"
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normFunctionExpression(original_obj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: 'ArrowFunctionExpression',
                            id: createTestingObj('foo_'),
                            params: [],
                            body: createTestingObj('stmt_'),
                            generator: false,
                            async: false,
                            expression: false,
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj,
    });
});

test('normalize ArrowFunctionExpression (2) with Expression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'ArrowFunctionExpression',
        id: createTestingObj('foo'),
        params: [],
        body: createTestingObj('expr'),
        generator: false,
        async: false,
        expression: false,
    };

    const children = [ childExpr('foo_'), childExpr('expr_') ];

    const variable_obj = {
        type: "Identifier",
        name: "v0"
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normFunctionExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: 'ArrowFunctionExpression',
                            id: createTestingObj('foo_'),
                            params: [],
                            body: createTestingObj('expr_'),
                            generator: false,
                            async: false,
                            expression: false,
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj,
    });
});

test('normalize CallExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: 'CallExpression',
        callee: createTestingObj('callee'),
        arguments: [ createTestingObj('expr_1'), createTestingObj('expr_2') ],
    };

    const children = [ childExpr('callee_'),childExpr('expr_1_'), childExpr('expr_2_') ];

    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normCallExpression(original_obj, children)).toMatchObject({
        stmts: [
            'callee_',
            'expr_1_',
            'expr_2_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: 'CallExpression',
                            callee: createTestingObj('callee_'),
                            arguments: [ createTestingObj('expr_1_'), createTestingObj('expr_2_') ],
                        },
                    },
                ],
                kind: "let",
            },
        ],
        expr: variable_obj,
    });
});

test('normalize MemberExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "MemberExpression",
        computed: false,
        object: createTestingObj('expr_1'),
        property: createTestingObj('expr_2'),
    };

    const children = [ childExpr('expr_1_'), childExpr('expr_2_') ];

    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normMemberExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            'expr_2_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: "MemberExpression",
                            computed: false,
                            object: createTestingObj('expr_1_'),
                            property: createTestingObj('expr_2_'),
                        },
                    },
                ],
                kind: "let",
            }
        ],
        expr: variable_obj,
    });
});

test('normalize ObjectExpression', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "ObjectExpression",
        properties: [
            createTestingObj('expr_1'),
            createTestingObj('expr_2'),
        ],
    };

    const children = [ childExpr('expr_1_'), childExpr('expr_2_') ];

    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normObjectExpression(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            'expr_2_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: {
                            type: "ObjectExpression",
                            properties: [
                                createTestingObj('expr_1_'),
                                createTestingObj('expr_2_'),
                            ],
                        },
                    },
                ],
                kind: "let",
            }
        ],
        expr: variable_obj,
    });
});

test('normalize Property with Identifier key and Literal value', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "Property",
        key: createTestingObj('expr_1'),
        computed: false,
        value: createTestingObj('expr_2'),
        kind: "init",
        method: false,
        shorthand: false,
    };

    const children = [ childExpr('expr_1_'), childExpr('expr_2_') ];

    expect(normProperty(original_obj, children)).toMatchObject({
        stmts: [ 'expr_1_', 'expr_2_' ],
        expr: {
            type: "Property",
            key: createTestingObj('expr_1_'),
            computed: false,
            value: createTestingObj('expr_2_'),
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});

test('normalize Property with Identifier key and Expression value', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "Property",
        key: createTestingObj('expr_1'),
        computed: false,
        value: { type: "RandomTestingType" },
        kind: "init",
        method: false,
        shorthand: false,
    };

    const child_2 = {
        stmts: [],
        expr: { type: "RandomTestingType" },
    };

    const children = [ childExpr('expr_1_'), child_2 ];

    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normProperty(original_obj, children)).toMatchObject({
        stmts: [
            'expr_1_',
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: { type: "RandomTestingType" },
                    },
                ],
                kind: "let",
            }
        ],
        expr: {
            type: "Property",
            key: createTestingObj('expr_1_'),
            computed: false,
            value: variable_obj,
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});

test('normalize Property with Expression key and Literal value', () => {
    const createTestingObj = (name) => ({ type: 'Identifier', name });
    const childExpr = (name) => ({ stmts: [ name ], expr: createTestingObj(name) });

    const original_obj = {
        type: "Property",
        key: { type: "RandomTestingType" },
        computed: false,
        value: createTestingObj('expr_2'),
        kind: "init",
        method: false,
        shorthand: false,
    };

    const child_1 = {
        stmts: [],
        expr: { type: "RandomTestingType" },
    };

    const children = [ child_1, childExpr('expr_2_') ];

    const variable_obj = {
        type: 'Identifier',
        name: 'v0',
    };

    resetVariableCount(); // setting this to make sure next variable name is v0
    expect(normProperty(original_obj, children)).toMatchObject({
        stmts: [
            {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: variable_obj,
                        init: { type: "RandomTestingType" },
                    },
                ],
                kind: "let",
            },
            'expr_2_',
        ],
        expr: {
            type: "Property",
            key: variable_obj,
            computed: false,
            value: createTestingObj('expr_2_'),
            kind: "init",
            method: false,
            shorthand: false,
        },
    });
});