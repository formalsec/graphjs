let { getNextVariableName, copyObj } = require('../utils/utils');

const createVariableDeclaration = (obj, variable_name) => {
    const var_obj = {
        type: "Identifier",
        name: variable_name,
    };
    
    let new_stmt = copyObj({
        type: "VariableDeclaration",
        declarations: [
            copyObj({
                type: "VariableDeclarator",
                id: copyObj(var_obj),
                init: obj,
            })
        ],
        kind: "let",
    });

    return { var_obj: copyObj(var_obj), new_stmt };
};

const flatStmts = (children) => children.map((child) => child.stmts).flat();
const flatExprs = (children) => children.map((child) => child.expr).flat();
const isNotLiteral = (obj) => obj.type !== 'Literal' && obj.type !== 'Identifier';

const normProgram = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.body    = flatStmts(children);
    return { stmts: [ new_obj ], expr: null };
};

const normBinaryExpression = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.left    = children[0].expr;
    new_obj.right   = children[1].expr;
    
    const variable  = getNextVariableName();
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, new_stmt],
        expr: var_obj,
    };
};

const normVariableDeclaration = (obj, children) => {
    const new_stmts = flatStmts(children);
    const exprs     = flatExprs(children).map((expr) => {
        const new_obj = copyObj(obj);
        new_obj.declarations = [ expr ];
        return new_obj;
    });

    return {
        stmts: [...new_stmts, ...exprs],
        expr: null
    };
};

const normVariableDeclarator = (obj, children) => {
    const new_obj = copyObj(obj);
    let stmts = [];

    new_obj.id = children[0].expr;
    if (children[1]) {
        stmts = [...children[1].stmts]; 
        const init_expression = children[1].expr;
        new_obj.init = init_expression;
        
        // This only applies if the child was a binary expression that required normalization
        // if (init_expression.type === "Identifier" && children[1].stmts.length > 0) {
        //     const init_expression_id = init_expression.name;
        //     const last_stmt = children[1].stmts.slice(-1)[0];

        //     if (last_stmt.type === "VariableDeclaration" && last_stmt.declarations[0].id.name === init_expression_id) {
        //         stmts = children[1].stmts.slice(0, children[1].stmts.length-1); // remove last stmt
        //         new_obj.init = last_stmt.declarations[0].init;
        //     }
        // }
    }

    return {
        stmts,
        expr: new_obj,
    };
};

const normBlockStatement = (obj, children) => {
    const stmts = flatStmts(children);

    // shouldn't really be anything here
    const exprs = flatExprs(children).filter(elem => elem != null);

    const new_obj = copyObj(obj);
    new_obj.body = [...stmts, ...exprs];
    return {
        stmts: [ new_obj ],
        expr: null,
    };
};

const normIfStatement = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.test    = children[0].expr;
    new_obj.consequent = children[1].stmts[0];

    if (new_obj.alternate) {
        new_obj.alternate = children[2].stmts[0];
    }

    return {
        stmts: [ ...children[0].stmts, new_obj],
        expr: null,
    };
};

const normConditionalExpression = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.test    = children[0].expr;
    new_obj.consequent = children[1].expr;
    new_obj.alternate = children[2].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, ...children[2].stmts],
        expr: new_obj,
    };
};

const normWhileStatement = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.test    = children[0].expr;
    new_obj.body    = children[1].stmts[0];

    return {
        stmts: [...children[0].stmts, new_obj],
        expr: null,
    };
};

const normAssignmentExpressions = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.left    = children[0].expr;
    new_obj.right   = children[1].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts],
        expr: new_obj,
    };
};

const normExpressionStatement = (obj, children) => {
    const new_obj = copyObj(obj);
    new_obj.expression = children[0].expr

    return {
        stmts: [...children[0].stmts, new_obj] ,
        expr: null,
    };;
};

const normUpdateExpression = (obj, children) => {
    const new_obj = copyObj(obj);
    new_obj.argument = children[0].expr;

    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);

    return {
        stmts: [...children[0].stmts, new_stmt],
        expr: var_obj,
    };
};

const normFunctionDeclaration = (obj, children) => {
    const new_obj = copyObj(obj);

    if(children[0]) {
        new_obj.id = children[0].expr;
    }

    new_obj.body = children[1].stmts[0];

    return {
        stmts: [ new_obj ],
        expr: null,
    };
};

const normReturnStatement = (obj, children) => {
    const new_obj = copyObj(obj);
    new_obj.argument = children[0].expr;

    return {
        stmts: [...children[0].stmts, new_obj],
        expr: null,
    };
};

const normFunctionExpression = (obj, children) => {
    const new_obj = copyObj(obj);
    let stmts = [];

    if (children[0]) {
        new_obj.id = children[0].expr;
    }

    if (children[1].expr) { // ArrowFunctionExpression
        new_obj.body = children[1].expr;
        stmts = children[1].stmts;
    } else { // FunctionExpression
        new_obj.body = children[1].stmts[0];
    }

    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);
    stmts.push(new_stmt);

    return {
        stmts,
        expr: var_obj,
    };
};

// TODO: Ask Prof. José what should be done in this case
// IDEA: change it to a while??
// function normForStatement(obj, children) {
//     const stmts = children[0].stmts.concat(children[2].stmts);
    
//     const new_obj = copyObj(obj);
//     new_obj.init = children[0].expr;
//     //new_obj.test = children[1].expr;
//     new_obj.update = children[2].expr;
//     new_obj.body = children[3].stmts[0];

//     return {
//         stmts: stmts.concat(new_obj),
//         expr: null,
//     };
// }

const normCallExpression = (obj, children) => {
    const new_obj   = copyObj(obj);
    new_obj.callee  = children[0].expr;
    new_obj.arguments = flatExprs(children.slice(1)); // immutable shift()

    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);

    return {
        stmts: [...flatStmts(children), new_stmt],
        expr: var_obj,
    };
};

function normMemberExpression(obj, children) {
    const new_obj = copyObj(obj);
    new_obj.object = children[0].expr;
    new_obj.property = children[1].expr;

    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, new_stmt],
        expr: var_obj,
    };
}

function normObjectExpression(obj, children) {
    const new_obj = copyObj(obj);
    new_obj.properties = children.map((child) => child.expr).flat();

    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);
    
    return {
        stmts: [...flatStmts(children), new_stmt],
        expr: var_obj,
    };
}

function normProperty(obj, children) {
    const new_obj = copyObj(obj);
    
    let key_stmts = [...children[0].stmts]; // Copy
    let value_stmts = [...children[1].stmts]; // Copy

    if (isNotLiteral(children[0].expr)) {
        const variable  = getNextVariableName();
        const { var_obj, new_stmt } = createVariableDeclaration(children[0].expr, variable);
        new_obj.key = var_obj;
        key_stmts.push(new_stmt);
    } else {
        new_obj.key = children[0].expr;
    }

    if (isNotLiteral(children[1].expr)) {
        const variable  = getNextVariableName();
        const { var_obj, new_stmt } = createVariableDeclaration(children[1].expr, variable);
        new_obj.value = var_obj;
        value_stmts.push(new_stmt);
    } else {
        new_obj.value = children[1].expr;
    }

    return {
        stmts: [...key_stmts, ...value_stmts],
        expr: new_obj,
    };
}

function normalize(obj) {
    function mapReduce(arr) {
        return arr.map((item) => normalize(item));
    }

    if (obj === null) {
        return null;
    }

    switch (obj.type) {
        //
        // Scripts
        //
        case "Program": {
            resultData = mapReduce(obj.body);
            return normProgram(obj, resultData);
        }

        case "Identifier":
        case "Literal":
            return {
                stmts: [],
                expr: copyObj(obj),
            };

        //
        // Expressions
        //
        // case "ArrayExpression":
        //     resultData = mapReduce(obj.elements);
        //     break;

        case "ObjectExpression":
            resultData = mapReduce(obj.properties);
            return normObjectExpression(obj, resultData);

        case "Property": {
            const resultKey = normalize(obj.key);
            const resultValue = normalize(obj.value);

            resultData = [
            resultKey,
            resultValue
            ];
            return normProperty(obj, resultData);
        }

        case "MemberExpression": {
            const resultObject = normalize(obj.object);
            const resultProperty = normalize(obj.property);

            resultData = [
            resultObject,
            resultProperty
            ];
            return normMemberExpression(obj, resultData);
        }

        case "CallExpression":
        case "NewExpression": {
            const resultCallee = normalize(obj.callee);
            const resultArguments = mapReduce(obj.arguments);

            resultArguments.unshift(resultCallee);
            resultData = resultArguments;
            return normCallExpression(obj, resultData);
        }

        case "UpdateExpression":
        case "UnaryExpression":
            resultData = [ normalize(obj.argument) ];
            return normUpdateExpression(obj, resultData);

        case "BinaryExpression":
        case "LogicalExpression": {
            const resultLeft = normalize(obj.left);
            const resultRight = normalize(obj.right);

            resultData = [
                resultLeft,
                resultRight
            ];
            return normBinaryExpression(obj, resultData);
        }

        case "AssignmentExpression": {
            const resultLeft = normalize(obj.left);
            const resultRight = normalize(obj.right);

            resultData = [
            resultLeft,
            resultRight
            ];
            return normAssignmentExpressions(obj, resultData);
        }

        // case "SequenceExpression":
        //     resultData = mapReduce(obj.expressions);
        //     break;

        //
        // Statements and Declarations
        //
        case "BlockStatement": {
            resultData = mapReduce(obj.body);
            return normBlockStatement(obj, resultData);
        }

        case "DoWhileStatement":
        case "WhileStatement": {
            const resultTest = normalize(obj.test);
            const resultBody = normalize(obj.body);

            resultData = [
            resultTest,
            resultBody
            ];
            return normWhileStatement(obj, resultData);
        }

        case "ExpressionStatement": {
            resultData = [ normalize(obj.expression) ];
            return normExpressionStatement(obj, resultData);
        }

        // case "ForStatement": {
        //     const resultInit = normalize(obj.init);
        //     const resultTest = normalize(obj.test);
        //     const resultUpdate = normalize(obj.update);
        //     const resultBody = normalize(obj.body);

        //     resultData = [
        //     resultInit,
        //     resultTest,
        //     resultUpdate,
        //     resultBody
        //     ];
        //     break;
        // }

        // case "ForInStatement": {
        //     const resultLeft = normalize(obj.left);
        //     const resultRight = normalize(obj.right);
        //     const resultBody = normalize(obj.body);

        //     resultData = [
        //     resultLeft,
        //     resultRight,
        //     resultBody
        //     ];
        //     break;
        // }

        case "FunctionDeclaration": {
            const resultId = normalize(obj.id);
            const resultBody = normalize(obj.body);
            resultData = [ resultId, resultBody ];
            return normFunctionDeclaration(obj, resultData);
        }

        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "LabeledStatement": {
            const resultId = normalize(obj.id);
            const resultBody = normalize(obj.body);
            resultData = [ resultId, resultBody ];
            return normFunctionExpression(obj, resultData);
        }

        case "IfStatement": {
            const resultTest = normalize(obj.test);
            const resultConsequent = normalize(obj.consequent);
            const resultAlternate = normalize(obj.alternate);

            resultData = [
                resultTest,
                resultConsequent,
                resultAlternate
            ];
            return normIfStatement(obj, resultData);
        }

        case "ConditionalExpression": {
            const resultTest = normalize(obj.test);
            const resultConsequent = normalize(obj.consequent);
            const resultAlternate = normalize(obj.alternate);

            resultData = [
                resultTest,
                resultConsequent,
                resultAlternate
            ];
            return normConditionalExpression(obj, resultData);
        }

        case "ReturnStatement":
        case "ThrowStatement": {
            resultData = [ normalize(obj.argument) ];
            return normReturnStatement(obj, resultData);
        }

        // case "SwitchStatement": {
        //     const resultDiscriminant = normalize(obj.discriminant);
        //     const resultCases = mapReduce(obj.cases);

        //     resultCases.unshift(resultDiscriminant);
        //     resultData = resultCases;
        //     break;
        // }

        // case "SwitchCase": {
        //     const resultTest = normalize(obj.test);
        //     const resultConsequent = mapReduce(obj.consequent);

        //     resultConsequent.unshift(resultTest);
        //     resultData = resultConsequent;
        //     break;
        // }

        case "VariableDeclaration": {
            resultData = mapReduce(obj.declarations);
            return normVariableDeclaration(obj, resultData);
        }

        case "VariableDeclarator": {
            const resultId = normalize(obj.id);
            const resultInit = normalize(obj.init);

            resultData = [ resultId, resultInit ];
            return normVariableDeclarator(obj, resultData);
        }

        // case "WithStatement": {
        //     const resultObject = normalize(obj.object);
        //     const resultBody = normalize(obj.body);

        //     resultData = [ resultObject, resultBody ];
        //     break;
        // }

        // case "TryStatement": {
        //     const resultBlock = normalize(obj.block);
        //     const resultHandler = normalize(obj.handler);
        //     const resultFinalizer = normalize(obj.finalizer);

        //     resultData = [
        //     resultBlock,
        //     resultHandler,
        //     resultFinalizer
        //     ];
        //     break;
        // }

        // case "CatchClause": {
        //     const resultParam = normalize(obj.param);
        //     const resultBlock = normalize(obj.body);

        //     resultData = [ resultParam, resultBlock ];
        //     break;
        // }   
    }

    return {
        stmts: [],
        expr: null
    };
}


module.exports = {
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
};