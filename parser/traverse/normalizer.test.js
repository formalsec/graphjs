const { setVariableCount } = require('../utils/utils');
const {
    createVariableDeclaration,
    flatStmts,
    flatExprs,
    normProgram,
    normBinaryExpression,
    normVariableDeclaration,
    normVariableDeclarator,
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

    expect(createVariableDeclaration(old_object, variable_name)).toEqual(expected_return);
});

test('flat statements of children array', () => {
    const children = [ { stmts: [1, 2, 3] }, { stmts: [4, 5, 6] } ];
    expect(flatStmts(children)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('flat expressions of children array', () => {
    const children = [ { expr: 1 }, { expr: 2 }, { expr: 3 }, { expr: 4 } ];
    expect(flatExprs(children)).toEqual([1, 2, 3, 4]);
});

test('normalize Program object', () => {
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

    expect(normProgram(original_prog, children)).toEqual({
        stmts: [ expected_prog ],
        expr: null,
    });

    expect(normProgram(original_prog, children)).not.toBe({
        stmts: [ expected_prog ],
        expr: null,
    });
    
});

test('normalize BinaryExpression object', () => {
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

    setVariableCount(0); // setting this to make sure next variable name is v0
    expect(normBinaryExpression(original_binary_expr, children)).toEqual({
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

    expect(normVariableDeclaration(original_stmt, children)).toEqual({
        stmts: [
            3, 4, 5,
            createDeclaration(3),
            createDeclaration(4),
            createDeclaration(5)
        ],
        expr: null,
    });
});

test('normalize VariableDeclarator object (1) without binary expression', () => {
    const createVariable = (n) => ({ variable: `v${n}` });
    const childrenExample  = (n) => ({ stmts: [n], expr: createVariable(n) });
    
    const id_obj = { type: 'Identifier', name: 'v0' };
    const original_obj = {
        type: 'VariableDeclarator',
        id: id_obj,
        init: createVariable(0),
    };

    children = [ { stmts: [], expr: id_obj }, childrenExample(1) ]

    expect(normVariableDeclarator(original_obj, children)).toEqual({
        stmts: [1],
        expr: {
            type: 'VariableDeclarator',
            id: id_obj,
            init: createVariable(1),
        }
    });
});

test('normalize VariableDeclarator object (2) with binary expression', () => {
    const createVariable = (name) => ({ type: 'Identifier', name });
    const childrenExample  = (name) => ({ stmts: [name], expr: createVariable(name) });
    
    const id_obj = { type: 'Identifier', name: 'v0' };
    const original_obj = {
        type: 'VariableDeclarator',
        id: id_obj,
        init: createVariable('x'),
    };

    children = [ { stmts: [], expr: id_obj }, childrenExample('x') ]

    expect(normVariableDeclarator(original_obj, children)).toEqual({
        stmts: ['x'],
        expr: {
            type: 'VariableDeclarator',
            id: id_obj,
            init: createVariable('x'),
        }
    });
});

test('normalize VariableDeclarator object (3) with binary expression needing to normalize', () => {
    const createVariable = (name) => ({ type: 'Identifier', name });
    const createDeclaration = (name) => ({
        type: 'VariableDeclaration',
        declarations: [
            {
                type: 'VariableDeclarator',
                id: createVariable(name),
                init: { hello: 'world' },
            }
        ],
        kind: 'let',
    });
    const childrenExample  = (name) => ({
        stmts: [createDeclaration(name)],
        expr: createVariable(name)
    });
    
    const id_obj = createVariable('x');
    const original_obj = {
        type: 'VariableDeclarator',
        id: id_obj,
        init: createVariable('v0'),
    };

    children = [ { stmts: [], expr: id_obj }, childrenExample('v0') ]

    expect(normVariableDeclarator(original_obj, children)).toEqual({
        stmts: [],
        expr: {
            type: 'VariableDeclarator',
            id: id_obj,
            init: { hello: 'world' },
        }
    });
});