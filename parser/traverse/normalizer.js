// eslint-disable-next-line no-unused-vars
const { getNextVariableName, copyObj, printJSON } = require("../utils/utils");

const createIdentifierObject = (variableName) => ({
    type: "Identifier",
    name: variableName,
});

const createEmptyObject = () => ({
    type: "ObjectExpression",
    properties: [],
});

const createVariableDeclaration = (obj, variableName) => {
    const varObj = createIdentifierObject(variableName);

    const newStmt = {
        type: "VariableDeclaration",
        declarations: [
            copyObj({
                type: "VariableDeclarator",
                id: copyObj(varObj),
                init: obj,
            }),
        ],
        kind: "const",
    };

    return { varObj: copyObj(varObj), newStmt: copyObj(newStmt) };
};

const createVariableDeclarator = (variableName, newInit) => {
    const varObj = createIdentifierObject(variableName);

    const newStmt = {
        type: "VariableDeclarator",
        id: copyObj(varObj),
        init: copyObj(newInit),
    };

    return { varObj: copyObj(varObj), newStmt: copyObj(newStmt) };
};

const createObjectLookupDeclarator = (key, propertyValue, objectValue) => {
    const memExpr = {
        type: "MemberExpression",
        computed: false,
        object: copyObj(objectValue),
        property: propertyValue,
    };

    return {
        type: "VariableDeclarator",
        id: copyObj(key),
        init: copyObj(memExpr),
    };
};

const createPropertyAssignment = (objectIdentifier, propertyName, propertyValue) => ({
    type: "ExpressionStatement",
    expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
            type: "MemberExpression",
            computed: false,
            object: copyObj(objectIdentifier),
            property: createIdentifierObject(propertyName),
        },
        right: copyObj(propertyValue),
    },
});

const unpattern = (declarations) => {
    const unpatternedDeclarations = [];

    declarations.forEach((decl) => {
        if (decl.id.type === "ObjectPattern") {
            const originalInit = decl.init;
            const variable = getNextVariableName();
            const { varObj, newStmt } = createVariableDeclarator(variable, originalInit);

            // push a new variable with the member expression
            unpatternedDeclarations.push(newStmt);

            // push declarations for each property using accesses to new variable
            decl.id.properties.forEach(
                (prop) => unpatternedDeclarations.push(
                    createObjectLookupDeclarator(prop.key, prop.value, varObj),
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
const isNotEmpty = (obj) => {
    if (obj.type === "ArrayExpression") {
        return obj.elements.length > 0;
    }

    return true;
};

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
    const exprs = flatExprs(children)
        // remove expr === null which happens in some cases when
        // the declarator has no expression due to normalization
        .filter((expr) => expr)
        .map((expr) => {
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

    // children 0 is identifier
    newObj.id = children[0].expr;

    // children 1 is init
    const newInit = children[1];
    if (newInit) {
        if (newInit.expr.type === "ObjectExpression") {
            const objExpr = newInit.expr;
            // push empty object for this identifier
            newObj.init = createEmptyObject();

            const newAssignments = [];
            // push declarations for each property using accesses to new variable
            objExpr.properties.forEach((prop) => {
                const propertyName = prop.key.name;
                newAssignments.push(createPropertyAssignment(newObj.id, propertyName, prop.value));
            });
            stmts = [...newInit.stmts, newObj, ...newAssignments];
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

const normCallExpression = (obj, children, parent) => {
    const newObj = copyObj(obj);
    newObj.callee = children[0].expr;
    newObj.arguments = flatExprs(children.slice(1));

    if (parent && (parent.type === "VariableDeclarator" || parent.type === "ExpressionStatement")) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj,
        };
    }

    const variable = getNextVariableName();
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...flatStmts(children), newStmt],
        expr: varObj,
    };
};

function normMemberExpression(obj, children, parent) {
    const newObj = copyObj(obj);
    newObj.object = children[0].expr;
    newObj.property = children[1].expr;

    if (parent && (parent.type === "VariableDeclarator" || parent.type === "ExpressionStatement")) {
        return {
            stmts: [...children[0].stmts, ...children[1].stmts],
            expr: newObj,
        };
    }

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...children[0].stmts, ...children[1].stmts, newStmt],
        expr: varObj,
    };
}

function normObjectExpression(obj, children, parent) {
    const newObj = copyObj(obj);
    newObj.properties = [...flatExprs(children)];

    if (parent && (parent.type === "VariableDeclarator" || parent.type === "ExpressionStatement")) {
        return {
            stmts: [...flatStmts(children)],
            expr: newObj,
        };
    }

    const variable = getNextVariableName(); // Change this to a function so it is cleaner
    const { varObj, newStmt } = createVariableDeclaration(newObj, variable);

    return {
        stmts: [...flatStmts(children), newStmt],
        expr: varObj,
    };
}

function normProperty(obj, children) {
    const newObj = copyObj(obj);

    const keyStmts = [...children[0].stmts];
    const valueStmts = [...children[1].stmts];

    const childZeroExpr = children[0].expr;
    if (isNotLiteral(childZeroExpr)) {
        const variable = getNextVariableName();
        const { varObj, newStmt } = createVariableDeclaration(childZeroExpr, variable);
        newObj.key = varObj;
        keyStmts.push(newStmt);
    } else {
        newObj.key = childZeroExpr;
    }

    const childOneExpr = children[1].expr;
    if (isNotLiteral(childOneExpr) && isNotEmpty(childOneExpr)) {
        const variable = getNextVariableName();
        const { varObj, newStmt } = createVariableDeclaration(childOneExpr, variable);
        newObj.value = varObj;
        valueStmts.push(newStmt);
    } else {
        newObj.value = childOneExpr;
    }

    return {
        stmts: [...keyStmts, ...valueStmts],
        expr: newObj,
    };
}

function normArrayExpression(obj, children) {
    const newObj = copyObj(obj);
    newObj.elements = [...flatExprs(children)];

    return {
        stmts: [...flatStmts(children)],
        expr: newObj,
    };
}

function normalize(obj, parent) {
    function mapReduce(arr, p) {
        return arr.map((item) => normalize(item, p));
    }

    if (obj === null) {
        return null;
    }

    switch (obj.type) {
    //
    // Scripts
    //
    case "Program": {
        const resultData = mapReduce(obj.body, obj);
        return normProgram(obj, resultData, parent);
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
        return normArrayExpression(obj, resultData, parent);
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
        return normProperty(obj, resultData, parent);
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
        let resultLeft;
        if (obj.left.type === "MemberExpression") {
            resultLeft = { stmts: [], expr: obj.left };
        } else {
            resultLeft = normalize(obj.left, obj);
        }
        const resultRight = normalize(obj.right, obj);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normAssignmentExpressions(obj, resultData);
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

    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "LabeledStatement": {
        const resultId = normalize(obj.id, obj);
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultId, resultBody];
        return normFunctionExpression(obj, resultData);
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
        return normVariableDeclarator(obj, resultData);
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
