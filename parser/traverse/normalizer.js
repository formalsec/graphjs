let { getNextVariableName, copyObj } = require('../utils/utils');

const createVariableDeclaration = (obj, variable_name) => {
    const var_obj = {
        type: "Identifier",
        name: variable_name,
    };
    
    let new_stmt = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: var_obj,
                init: obj,
            }
        ],
        kind: "let",
    };

    return { var_obj, new_stmt };
};

const flatStmts = (children) => children.map((child) => child.stmts).flat();
const flatExprs = (children) => children.map((child) => child.expr).flat();

const normProgram = (obj, children) => {
    const stmts = flatStmts(children);
    const new_obj = copyObj(obj);
    new_obj.body = stmts;
    return { stmts: [ new_obj ], expr: null };
};

const normBinaryExpression = (obj, children) => {
    const new_stmts = children[0].stmts.concat(children[1].stmts);
            
    const new_obj   = copyObj(obj);
    new_obj.left    = children[0].expr;
    new_obj.right   = children[1].expr;
    
    const variable  = getNextVariableName(); // Change this to a function so it is cleaner
    const { var_obj, new_stmt } = createVariableDeclaration(new_obj, variable);

    return {
        stmts: new_stmts.concat(new_stmt),
        expr: var_obj,
    };;
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

    if (children[1]) {
        stmts = children[1].stmts; 
        const init_expression = children[1].expr;
        new_obj.init = init_expression;
        
        // This only applies if the chil was a binary expression that required normalization
        if (init_expression.type === "Identifier" && children[1].stmts.length > 0) {
            const init_expression_id = init_expression.name;
            const last_stmt = children[1].stmts.slice(-1)[0];

            if (last_stmt.type === "VariableDeclaration" && last_stmt.declarations[0].id.name === init_expression_id) {
                children[1].stmts.pop(); // remove stmt
                new_obj.init = last_stmt.declarations[0].init;
            }
        }
    }

    return {
        stmts,
        expr: new_obj,
    };
};

function normBlockStatement(obj, children) {
    const stmts = flatStmts(children);
    const exprs = flatExprs(children).filter(elem => elem != null);

    const new_obj = copyObj(obj);
    new_obj.body = stmts.concat(exprs);

    return {
        stmts: [new_obj],
        expr: null,
    };
}

function normIfStatement(obj, children) {
    let new_stmts = children[0].stmts;
    const new_obj = copyObj(obj);
    new_obj.test = children[0].expr;
    new_obj.consequent = children[1].stmts[0];

    if (new_obj.alternate) {
        new_obj.alternate = children[2].stmts[0];
    }

    return {
        stmts: new_stmts.concat(new_obj),
        expr: null,
    };
}

function normConditionalExpression(obj, children) {
    let new_stmts = children[0].stmts.concat(children[1].stmts, children[2].stmts);
    const new_obj = copyObj(obj);
    new_obj.test = children[0].expr;
    new_obj.consequent = children[1].expr;
    new_obj.alternate = children[2].expr;

    return {
        stmts: new_stmts,
        expr: new_obj,
    };
}

function normWhileStatement(obj, children) {
    const new_obj = copyObj(obj);
    new_obj.test = children[0].expr;
    new_obj.body = children[1].stmts[0];

    return {
        stmts: children[0].stmts.concat(new_obj),
        expr: null,
    };
}

function normAssignmentExpressions(obj, children) {
    const stmts = children[0].stmts.concat(children[1].stmts);
    const new_obj = copyObj(obj);
    new_obj.left = children[0].expr;
    new_obj.right = children[1].expr;

    return {
        stmts,
        expr: new_obj,
    };
}

function normExpressionStatement(obj, children) {
    let stmts = (children[0].expr) ?
        children[0].stmts.concat(children[0].expr) :
        children[0].stmts;

    return {
        stmts,
        expr: null,
    };
}

function normUpdateExpression(obj, children) {
    const stmts = children[0].stmts;
    const new_obj = copyObj(obj);
    new_obj.argument = children[0].expr;

    return {
        stmts,
        expr: new_obj,
    };
}

function normFunctionDeclaration(obj, children) {
    const new_obj = copyObj(obj);
    new_obj.body = children[0].stmts[0];

    return {
        stmts: [new_obj],
        expr: null,
    };
}

function normFunctionExpression(obj, children) {
    const new_obj = copyObj(obj);
    const child_expr = children[0].expr;
    const child_stmts = children[0].stmts;
    
    let stmts = [];

    if (child_expr) {
        new_obj.body = child_expr;
        stmts = child_stmts;
    } else {
        new_obj.body = child_stmts[0];
    }

    return {
        stmts,
        expr: new_obj,
    };
}

function normReturnStatement(obj, children) {
    const new_obj = copyObj(obj);
    new_obj.argument = children[0].expr;
    
    const stmts = children[0].stmts.concat(new_obj);

    return {
        stmts,
        expr: null,
    };
}

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

function normCallExpression(obj, children) {
    const stmts = flatStmts(children);
    const callee = children.shift();

    const new_obj = copyObj(obj);
    new_obj.callee = callee.expr;
    new_obj.arguments = children.map((child) => child.expr).flat();

    return {
        stmts,
        expr: new_obj,
    };
}

function normMemberExpression(obj, children) {
    const stmts = children[0].stmts.concat(children[1].stmts);
    
    const new_obj = copyObj(obj);
    new_obj.object = children[0].expr;
    new_obj.property = children[1].expr;

    return {
        stmts,
        expr: new_obj,
    };
}

function normObjectExpression(obj, children) {
    const stmts = flatStmts(children);

    const new_obj = copyObj(obj);
    new_obj.properties = children.map((child) => child.expr).flat();
    
    return {
        stmts,
        expr: new_obj,
    };
}

function normProperty(obj, children) {
    const stmts = children[0].stmts.concat(children[1].stmts);
    
    const key = children[0].expr;
    const value = children[1].expr;

    const new_obj = copyObj(obj);
    new_obj.key = key;
    new_obj.value = value;

    return {
        stmts,
        expr: new_obj,
    };
}

function normalize(obj, children) {
    if (!obj) {
        return null;
    }
    
    switch (obj.type) {

        case "Identifier":
        case "Literal":
            return {
                stmts: [],
                expr: obj,
            };

        case "BlockStatement":
            return normBlockStatement(obj, children);
        
        case "LogicalExpression":
        case "BinaryExpression":
            return normBinaryExpression(obj, children);

        case "IfStatement":
            return normIfStatement(obj, children);

        case "ConditionalExpression":
            return normConditionalExpression(obj, children);

        case "WhileStatement":
        case "DoWhileStatement":
            return normWhileStatement(obj, children);

        case "VariableDeclarator":
            return normVariableDeclarator(obj, children);
        
        case "VariableDeclaration":
            return normVariableDeclaration(obj, children);
                     
        case "ExpressionStatement":
            return normExpressionStatement(obj, children);

        case "AssignmentExpression":
            return normAssignmentExpressions(obj, children);

        case "UnaryExpression":
        case "UpdateExpression":
            return normUpdateExpression(obj, children);

        case "FunctionDeclaration":
            return normFunctionDeclaration(obj, children);

        case "ArrowFunctionExpression":
        case "FunctionExpression":
            return normFunctionExpression(obj, children);

        case "ReturnStatement":
        case "ThrowStatement":
            return normReturnStatement(obj, children);

        // case "ForStatement":
        //     return normForStatement(obj, children);
                            
        case "Program":
            return normProgram(obj, children);

        case "NewExpression":
        case "CallExpression":
            return normCallExpression(obj, children);

        case "MemberExpression":
            return normMemberExpression(obj, children);

        case "ObjectExpression":
            return normObjectExpression(obj, children);

        case "Property":
            return normProperty(obj, children);

        default:
            console.log("default ->", obj.type);
            return {
                stmts: [],
                expr: null
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
    
    normalize,
};