// eslint-disable-next-line no-unused-vars
import { getNextVariableName, copyObj, printJSON } from "../utils/utils";

import type {
    Node,
    Program,
} from "estree";

import {
    Normalization,
    normProgram,
    normArrayExpression,
    normObjectExpression,
    normProperty,
    normFunctionExpression,
    normArrowFunctionExpression,
    normClassExpression,
    normClassBody,
    normMethodDefinition,
    normMemberExpression,
    normCallExpression,
    normUpdateExpression,
    normAwaitYieldExpression,
    normBinaryExpression,
    normConditionalExpression,
    normAssignmentExpressions,
    normBlockStatement,
    normWhileStatement,
    normDoWhileStatement,
    normForStatement,
    normExpressionStatement,
    normFunctionDeclaration,
    normIfStatement,
    normReturnStatement,
    unpattern,
    normVariableDeclaration,
    normVariableDeclarator,
    normSequenceExpression
} from "./normalizerUtils";

function mapReduce(arr: (Node | null)[], p: Node): Normalization[] {
    return arr.map((item) => normalize(item, p));
}

export function normalizeScript(ast: Program): Program {
    const normalized = normalize(ast, null);
    if (normalized) return normalized.stmts[0] as Program;
    return ast;
}

function normalize(obj: Node | null | undefined, parent: Node | null): Normalization {
    if (obj === null || obj === undefined) {
        return {
            stmts: [],
            expr: null,
        };
    }

    switch (obj.type) {
    //
    // Scripts and Modules
    //
    case "Program": {
        const resultData = mapReduce(obj.body, obj);
        return normProgram(obj, resultData);
    }

    // case "ImportDeclaration": {}

    // case "ImportSpecifier": {}

    // case "ExportAllDeclaration": {}

    // case "ExportDefaultDeclaration": {}

    // case "ExportNamedDeclaration": {}

    // case "ExportSpecifier": {}

    //
    // Expressions
    //
    case "ThisExpression":
    case "Super":
    case "Identifier":
    case "Literal": {
        return {
            stmts: [],
            expr: copyObj(obj),
        };
    }

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
        const resultData = [resultKey,resultValue];
        return normProperty(obj, resultData);
    }

    case "FunctionExpression": {
        const resultId = normalize(obj.id, obj);
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultId, resultBody];
        return normFunctionExpression(obj, resultData, parent);
    }

    case "ArrowFunctionExpression": {
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultBody];
        return normArrowFunctionExpression(obj, resultData, parent);
    }

    case "ClassExpression": {
        const resultId = normalize(obj.id, obj);
        const resultSuperClass = normalize(obj.superClass, obj);
        const resultClassBody = normalize(obj.body, obj);
        const resultData = [resultId, resultSuperClass, resultClassBody];
        return normClassExpression(obj, resultData);
    }

    case "ClassBody": {
        const resultData = mapReduce(obj.body, obj);
        return normClassBody(obj, resultData)
    }

    case "MethodDefinition": {
        const resultKey = normalize(obj.key, obj);
        const resultValue = normalize(obj.value, obj);
        const resultData = [resultKey, resultValue];
        return normMethodDefinition(obj, resultData);
    }

    // case "TaggedTemplateExpression": {

    // }

    // case "TemplateLiteral": {

    // }

    // case "TemplateElement": {

    // }

    case "MemberExpression": {
        const resultObject = normalize(obj.object, obj);
        const resultProperty = normalize(obj.property, obj);

        const resultData = [
            resultObject,
            resultProperty,
        ];
        return normMemberExpression(obj, resultData, parent);
    }

    // case "MetaProperty": {
    //     const resultMeta = normalize(obj.meta, obj);
    //     const resultProperty = normalize(obj.property, obj);
    //     const resultData = [resultMeta, resultProperty];
    //     return normMetaProperty(obj, resultData);
    // }

    case "NewExpression":
    case "CallExpression": {
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

    case "AwaitExpression":
    case "SpreadElement":
    case "YieldExpression": {
            const resultData = [normalize(obj.argument, obj)];
            return normAwaitYieldExpression(obj, resultData);
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

    case "AssignmentExpression": {
        const resultLeft = normalize(obj.left, obj);
        const resultRight = normalize(obj.right, obj);

        const resultData = [
            resultLeft,
            resultRight,
        ];
        return normAssignmentExpressions(obj, resultData, parent);
    }

    case "SequenceExpression": {
        const resultData = mapReduce(obj.expressions, obj);
        return normSequenceExpression(obj, resultData);
    }

    // case "ArrayPattern": {}

    // case "RestElement": {}

    // case "AssignmentPattern": {}

    // case "ObjectPattern": {}

    //
    // Statements and Declarations
    //

    case "BlockStatement": {
        const resultData = mapReduce(obj.body, obj);
        return normBlockStatement(obj, resultData);
    }

    case "BreakStatement":
    case "ContinueStatement":
    case "DebuggerStatement":
    case "EmptyStatement": {
        return {
            stmts: [copyObj(obj)],
            expr: null,
        };
    }

    case "WhileStatement": {
        const resultTest = normalize(obj.test, obj);
        const resultBody = normalize(obj.body, obj);

        const resultData = [
            resultTest,
            resultBody,
        ];
        return normWhileStatement(obj, resultData);
    }

    case "DoWhileStatement":
        const resultTest = normalize(obj.test, obj);
        const resultBody = normalize(obj.body, obj);

        const resultData = [
            resultTest,
            resultBody,
        ];
        return normDoWhileStatement(obj, resultData);

    case "ExpressionStatement": {
        const resultData = [normalize(obj.expression, obj)];
        return normExpressionStatement(obj, resultData);
    }

    case "ForStatement": {
         const resultInit = normalize(obj.init, obj);
         const resultTest = normalize(obj.test, obj);
         const resultUpdate = normalize(obj.update, obj);
         const resultBody = normalize(obj.body, obj);

         const resultData = [
            resultInit,
            resultTest,
            resultUpdate,
            resultBody
         ];
         return normForStatement(obj, resultData);
    }

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

    // case "ForOfStatement": {}

    case "FunctionDeclaration": {
        const resultId = normalize(obj.id, obj);
        const resultBody = normalize(obj.body, obj);
        const resultData = [resultId, resultBody];
        return normFunctionDeclaration(obj, resultData);
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

    // case "LabeledStatement": {}

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

    case "VariableDeclaration": {
        const unpatternedDeclarations = unpattern(obj.declarations);
        const resultData = mapReduce(unpatternedDeclarations, obj);
        return normVariableDeclaration(obj, resultData);
    }

    case "VariableDeclarator": {
        const resultId = normalize(obj.id, obj);
        const resultInit = normalize(obj.init, obj);

        const resultData = [resultId, resultInit];
        return normVariableDeclarator(obj, resultData, parent);
    }

    // case "WithStatement": {
    //     const resultObject = normalize(obj.object, obj);
    //     const resultBody = normalize(obj.body, obj);

    //     const resultData = [resultObject, resultBody];
    //     break;
    // }

    // case "ClassDeclaration": {}

    default:
        throw Error(`Unknown type ${obj.type} to normalize.`);
        // console.log(`Normalization Error: Unknown type ${obj.type} to normalize.`);
        // return {
        //     stmts: [],
        //     expr: null,
        // };
    }
}
