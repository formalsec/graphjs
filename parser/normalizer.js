// const crypto = require('crypto');
let VAR_COUNT = require('./utils');

function createNewStatement(obj) {
    //const variable = `v${crypto.randomBytes(10).toString('hex')}`;
    const variable = `v${VAR_COUNT++}`;
    const var_obj = {
        "type": "Identifier",
        "name": variable,
    };
    
    let new_stmt = {
        "type": "VariableDeclaration",
        "declarations": [
            {
                "type": "VariableDeclarator",
                "id": var_obj,
                "init": obj,
            }
        ],
        "kind": "let"
    };

    return { var_obj, new_stmt };
}

function normProgram(obj, children) {
    const stmts = children.map((child) => child.stmts).flat();

    // console.log(JSON.stringify(stmts, null, 2));
    
    const new_obj = JSON.parse(JSON.stringify(obj));
    new_obj.body = stmts;
    
    // console.log({
    //     stmts: [new_obj],
    //     expr: null,
    // });

    return {
        stmts: [new_obj],
        expr: null,
    };
}

function normBinaryExpression(obj, children) {
    const new_stmts = children[0].stmts.concat(children[1].stmts);
            
    const new_obj = JSON.parse(JSON.stringify(obj));
    new_obj.left = children[0].expr;
    new_obj.right = children[1].expr;
    
    const { var_obj, new_stmt } = createNewStatement(new_obj);

    // console.log({
    //     stmts: new_stmts.concat(new_stmt),
    //     expr: var_obj,
    // });

    return {
        stmts: new_stmts.concat(new_stmt),
        expr: var_obj,
    };
}

function normVariableDeclaration(obj, children) {
    let new_stmts   = children.map((child) => child.stmts).flat();
    const exprs     = children.map((child) => child.expr).flat();

    exprs.forEach(expr => {
        const new_obj = JSON.parse(JSON.stringify(obj));
        new_obj.declarations = [ expr ];
        new_stmts = new_stmts.concat(new_obj);
    });

    // console.log(JSON.stringify({
    //     stmts: new_stmts,
    //     expr: null
    // }, null, 2));

    return {
        stmts: new_stmts,
        expr: null
    };
}

function normVariableDeclarator(obj, children) {
    const new_obj = JSON.parse(JSON.stringify(obj));
    new_obj.init = children[1].expr;

    if (children[1].stmts.length > 0) {
        let last_stmt = children[1].stmts.slice(-1)[0];
        // console.log(JSON.stringify(last_stmt, null, 2));

        if (last_stmt.type === "VariableDeclaration") {
            last_stmt = children[1].stmts.pop();
            new_obj.init = last_stmt.declarations[0].init;
        }
    }

    // console.log(JSON.stringify({
    //     stmts: children[1].stmts,
    //     expr: new_obj,
    // }, null, 2));

    return {
        stmts: children[1].stmts,
        expr: new_obj,
    };
}

function normBlockStatement(obj, children) {
    const stmts = children.map((child) => child.stmts).flat();
    const exprs = children.map((child) => child.expr ).flat().filter(elem => elem != null);

    const new_obj = JSON.parse(JSON.stringify(obj));
    new_obj.body = stmts.concat(exprs);

    // console.log({
    //     stmts: [new_obj],
    //     expr: null,
    // });

    return {
        stmts: [new_obj],
        expr: null,
    };
}

function normIfStatement(obj, children) {
    let new_stmts = children[0].stmts;
    const new_obj = JSON.parse(JSON.stringify(obj));
    new_obj.test = children[0].expr;
    new_obj.consequent = children[1].stmts[0];

    if (new_obj.alternate) {
        new_obj.alternate = children[2].stmts[0];
    }

    // console.log({
    //     stmts: new_stmts.concat(new_obj),
    //     expr: null,
    // });

    return {
        stmts: new_stmts.concat(new_obj),
        expr: null,
    };
}

function normalize(obj, children) {
    if (!obj) {
        return null;
    }
    
    switch (obj.type) {

        case "Identifier":
        case "Literal":
            // console.log("Literal / Identifier ==================");
            // console.log({
            //     stmts: [],
            //     expr: obj,
            // });
            return {
                stmts: [],
                expr: obj,
            };

        case "BlockStatement":
            // console.log("BlockStatement ==================");
            return normBlockStatement(obj, children);
        
        case "BinaryExpression":
            // console.log("BinaryExpression ==================");
            return normBinaryExpression(obj, children);

        case "IfStatement":
            // console.log("IfStatement ==================");
            return normIfStatement(obj, children);
        
        case "VariableDeclarator":
            // console.log("VariableDeclarator ==================");
            return normVariableDeclarator(obj, children);
        
        case "VariableDeclaration":
            // console.log("VariableDeclaration ==================");
            return normVariableDeclaration(obj, children);
                     
        case "ExpressionStatement":
            // console.log("ExpressionStatement ==================");
            // console.log(children[0]);
            return children[0];
                            
        case "Program":
            // console.log("Program ==================");
            return normProgram(obj, children);

        default:
            return {
                stmts: [],
                expr: null
            };
    }
}

module.exports = normalize;