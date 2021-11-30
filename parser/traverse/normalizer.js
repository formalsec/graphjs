const { getNextVariableName, copyObj } = require("../utils/utils");

const createVariableDeclaration = (obj, variableName) => {
    const varObj = {
        type: "Identifier",
        name: variableName,
    };

    const newStmt = copyObj({
        type: "VariableDeclaration",
        declarations: [
            copyObj({
                type: "VariableDeclarator",
                id: copyObj(varObj),
                init: obj,
            }),
        ],
        kind: "let",
    });

    return { varObj: copyObj(varObj), newStmt };
};

const createVariableDeclarator = (key, value, originalInit) => {
    const memExpr = {
        type: "MemberExpression",
        computed: false,
        object: copyObj(originalInit),
        property: value,
    };

    return {
        type: "VariableDeclarator",
        id: copyObj(key),
        init: copyObj(memExpr),
    };
};

const unpattern = (declarations) => {
    const unpatternedDeclarations = [];

    declarations.forEach((decl) => {
        if (decl.id.type === "ObjectPattern") {
            const originalInit = decl.init;
            decl.id.properties.forEach(
                (prop) => unpatternedDeclarations.push(
                    createVariableDeclarator(prop.key, prop.value, originalInit),
                ),
            );
        } else {
            unpatternedDeclarations.push(decl);
        }
    });

    return unpatternedDeclarations;
};

const flatStmts = (children) => children.map((child) => child.stmts).flat();
const flatExprs = (children) => children.map((child) => child.expr).flat();
const isNotLiteral = (obj) => obj.type !== "Literal" && obj.type !== "Identifier";

const normProgram = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.body = flatStmts(children);
    return { stmts: [newObj], expr: null };
};

const normBinaryExpression = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.left = children[0].expr;
    newObj.right = children[1].expr;

    const variable = getNextVariableName();
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, newStmt],
        expr: varObj,
    };
};

const normVariableDeclaration = (obj, children) => {
    const newStmts = flatStmts(children);
    const exprs = flatExprs(children).map((expr) => {
        const newObj = copyObj(obj);
        newObj.declarations = [expr];
        return newObj;
    });

    return {
        stmts: [...newStmts, ...exprs],
        expr: null,
    };
};

const normVariableDeclarator = (obj, children) => {
    const newObj = copyObj(obj);
    let stmts = [];

    newObj.id = children[0].expr;
    if (children[1]) {
        stmts = [...children[1].stmts];
        const initExpression = children[1].expr;
        newObj.init = initExpression;
    }

    return {
        stmts,
        expr: newObj,
    };
};

const normBlockStatement = (obj, children) => {
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

const normIfStatement = (obj, children) => {
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

const normConditionalExpression = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    newObj.consequent = children[1].expr;
    newObj.alternate = children[2].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, ...children[2].stmts],
        expr: newObj,
    };
};

const normWhileStatement = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.test = children[0].expr;
    [newObj.body] = children[1].stmts;

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

const normAssignmentExpressions = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.left = children[0].expr;
    newObj.right = children[1].expr;

    return {
        stmts: [...children[0].stmts, ...children[1].stmts],
        expr: newObj,
    };
};

const normExpressionStatement = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.expression = children[0].expr;

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

const normUpdateExpression = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.argument = children[0].expr;

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...children[0].stmts, newStmt],
        expr: varObj,
    };
};

const normFunctionDeclaration = (obj, children) => {
    const newObj = copyObj(obj);

    if (children[0]) {
        newObj.id = children[0].expr;
    }

    [newObj.body] = children[1].stmts;

    return {
        stmts: [newObj],
        expr: null,
    };
};

const normReturnStatement = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.argument = children[0].expr;

    return {
        stmts: [...children[0].stmts, newObj],
        expr: null,
    };
};

const normFunctionExpression = (obj, children) => {
    const newObj = copyObj(obj);
    let stmts = [];

    if (children[0]) {
        newObj.id = children[0].expr;
    }

    if (children[1].expr) { // ArrowFunctionExpression
        newObj.body = children[1].expr;
        stmts = children[1].stmts;
    } else { // FunctionExpression
        [newObj.body] = children[1].stmts;
    }

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);
    stmts.push(newStmt);

    return {
        stmts,
        expr: varObj,
    };
};

// TODO: Ask Prof. José what should be done in this case
// IDEA: change it to a while??
// function normForStatement(obj, children) {
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

const normCallExpression = (obj, children) => {
    const newObj = copyObj(obj);
    newObj.callee = children[0].expr;
    newObj.arguments = flatExprs(children.slice(1)); // immutable shift()

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...flatStmts(children), newStmt],
        expr: varObj,
    };
};

function normMemberExpression(obj, children) {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.property = children[1].expr;

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, newStmt],
        expr: varObj,
    };
}

function normObjectExpression(obj, children) {
    const newObj = copyObj(obj);
    newObj.properties = children.map((child) => child.expr).flat();

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...flatStmts(children), newStmt],
        expr: varObj,
    };
}

function normProperty(obj, children) {
    const newObj = copyObj(obj);

    const keyStmts = [...children[0].stmts]; // Copy
    const valueStmts = [...children[1].stmts]; // Copy

    if (isNotLiteral(children[0].expr)) {
        const variable = getNextVariableName();
        const { varObj, newStmt } = createVariableDeclaration(children[0].expr, variable);
        newObj.key = varObj;
        keyStmts.push(newStmt);
    } else {
        newObj.key = children[0].expr;
    }

    if (isNotLiteral(children[1].expr)) {
        const variable = getNextVariableName();
        const { varObj, newStmt } = createVariableDeclaration(children[1].expr, variable);
        newObj.value = varObj;
        valueStmts.push(newStmt);
    } else {
        newObj.value = children[1].expr;
    }

    return {
        stmts: [...keyStmts, ...valueStmts],
        expr: newObj,
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
        const resultData = mapReduce(obj.body);
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
    // case "ArrayExpression":
    //     resultData = mapReduce(obj.elements);
    //     break;

    case "ObjectExpression": {
        const resultData = mapReduce(obj.properties);
        return normObjectExpression(obj, resultData);
    }

    case "Property": {
        const resultKey = normalize(obj.key);
        const resultValue = normalize(obj.value);

        const resultData = [
            resultKey,
            resultValue,
        ];
        return normProperty(obj, resultData);
    }

    case "MemberExpression": {
        const resultObject = normalize(obj.object);
        const resultProperty = normalize(obj.property);

        const resultData = [
            resultObject,
            resultProperty,
        ];
        return normMemberExpression(obj, resultData);
    }

    case "CallExpression":
    case "NewExpression": {
        const resultCallee = normalize(obj.callee);
        const resultArguments = mapReduce(obj.arguments);

        resultArguments.unshift(resultCallee);
        const resultData = resultArguments;
        return normCallExpression(obj, resultData);
    }

    case "UpdateExpression":
    case "UnaryExpression": {
        const resultData = [normalize(obj.argument)];
        return normUpdateExpression(obj, resultData);
    }

    case "BinaryExpression":
    case "LogicalExpression": {
        const resultLeft = normalize(obj.left);
        const resultRight = normalize(obj.right);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normBinaryExpression(obj, resultData);
    }

    case "AssignmentExpression": {
        let resultLeft;
        if (obj.left.type === "MemberExpression") {
            resultLeft = { stmts: [], expr: obj.left };
        } else {
            resultLeft = normalize(obj.left);
        }
        const resultRight = normalize(obj.right);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normAssignmentExpressions(obj, resultData);
    }

    // case "SequenceExpression":
    //     const resultData = mapReduce(obj.expressions);
    //     break;

    //
    // Statements and Declarations
    //
    case "BlockStatement": {
        const resultData = mapReduce(obj.body);
        return normBlockStatement(obj, resultData);
    }

    case "DoWhileStatement":
    case "WhileStatement": {
        const resultTest = normalize(obj.test);
        const resultBody = normalize(obj.body);

        const resultData = [
            resultTest,
            resultBody,
        ];
        return normWhileStatement(obj, resultData);
    }

    case "ExpressionStatement": {
        const resultData = [normalize(obj.expression)];
        return normExpressionStatement(obj, resultData);
    }

    // case "ForStatement": {
    //     const resultInit = normalize(obj.init);
    //     const resultTest = normalize(obj.test);
    //     const resultUpdate = normalize(obj.update);
    //     const resultBody = normalize(obj.body);

    //     const resultData = [
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

    //     const resultData = [
    //     resultLeft,
    //     resultRight,
    //     resultBody
    //     ];
    //     break;
    // }

    case "FunctionDeclaration": {
        const resultId = normalize(obj.id);
        const resultBody = normalize(obj.body);
        const resultData = [resultId, resultBody];
        return normFunctionDeclaration(obj, resultData);
    }

    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "LabeledStatement": {
        const resultId = normalize(obj.id);
        const resultBody = normalize(obj.body);
        const resultData = [resultId, resultBody];
        return normFunctionExpression(obj, resultData);
    }

    case "IfStatement": {
        const resultTest = normalize(obj.test);
        const resultConsequent = normalize(obj.consequent);
        const resultAlternate = normalize(obj.alternate);

        const resultData = [
            resultTest,
            resultConsequent,
            resultAlternate,
        ];
        return normIfStatement(obj, resultData);
    }

    case "ConditionalExpression": {
        const resultTest = normalize(obj.test);
        const resultConsequent = normalize(obj.consequent);
        const resultAlternate = normalize(obj.alternate);

        const resultData = [
            resultTest,
            resultConsequent,
            resultAlternate,
        ];
        return normConditionalExpression(obj, resultData);
    }

    case "ReturnStatement":
    case "ThrowStatement": {
        const resultData = [normalize(obj.argument)];
        return normReturnStatement(obj, resultData);
    }

    // case "SwitchStatement": {
    //     const resultDiscriminant = normalize(obj.discriminant);
    //     const resultCases = mapReduce(obj.cases);

    //     resultCases.unshift(resultDiscriminant);
    //     const resultData = resultCases;
    //     break;
    // }

    // case "SwitchCase": {
    //     const resultTest = normalize(obj.test);
    //     const resultConsequent = mapReduce(obj.consequent);

    //     resultConsequent.unshift(resultTest);
    //     const resultData = resultConsequent;
    //     break;
    // }

    case "VariableDeclaration": {
        const unpatternedDeclarations = unpattern(obj.declarations);
        const resultData = mapReduce(unpatternedDeclarations);
        return normVariableDeclaration(obj, resultData);
    }

    case "VariableDeclarator": {
        const resultId = normalize(obj.id);
        const resultInit = normalize(obj.init);

        const resultData = [resultId, resultInit];
        return normVariableDeclarator(obj, resultData);
    }

    // case "WithStatement": {
    //     const resultObject = normalize(obj.object);
    //     const resultBody = normalize(obj.body);

    //     const resultData = [resultObject, resultBody];
    //     break;
    // }

    // case "TryStatement": {
    //     const resultBlock = normalize(obj.block);
    //     const resultHandler = normalize(obj.handler);
    //     const resultFinalizer = normalize(obj.finalizer);

    //     const resultData = [
    //     resultBlock,
    //     resultHandler,
    //     resultFinalizer
    //     ];
    //     break;
    // }

    // case "CatchClause": {
    //     const resultParam = normalize(obj.param);
    //     const resultBlock = normalize(obj.body);

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
