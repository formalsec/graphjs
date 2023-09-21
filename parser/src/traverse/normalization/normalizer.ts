import { copyObj } from "../../utils/utils"

import type {
    Node,
    Program
} from "estree";

import {
    type Normalization,
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
    normLabeledStatement,
    normIfStatement,
    normReturnStatement,
    unpattern,
    normVariableDeclaration,
    normVariableDeclarator,
    normSequenceExpression,
    normTemplateLiteral,
    normTaggedTemplateExpression,
    normClassDeclaration,
    normTryStatement,
    normCatchClause,
    normForInStatement,
    normWithStatement,
    normSimpleStatement,
    normExportDeclaration,
    normSimpleExpression,
    normSwitchStatement,
    normArrayPattern,
    normAssignmentPattern, createArrowFunctionBlockBody
} from "./normalizer_utils";

function mapReduce(arr: Array<Node | null>, p: Node | null): Normalization[] {
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
            expr: null
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

        //
        // Expressions
        //
        case "MetaProperty":
        case "TemplateElement":
        case "ThisExpression":
        case "Super":
        case "Identifier":
        case "Literal": {
            return normSimpleExpression(obj);
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
            const resultData = [resultKey, resultValue];
            return normProperty(obj, resultData);
        }

        case "FunctionExpression": {
            const resultId = normalize(obj.id, obj);
            const resultBody = normalize(obj.body, obj);
            const resultData = [resultId, resultBody];
            return normFunctionExpression(obj, resultData, parent);
        }

        case "ArrowFunctionExpression": {
            const blockBody = obj.body.type !== "BlockStatement" ? createArrowFunctionBlockBody(obj.body) : obj.body;
            obj.expression = false;
            const resultBody = normalize(blockBody, obj);
            const resultData = [resultBody];
            return normArrowFunctionExpression(obj, resultData, parent);
        }

        case "ClassExpression": {
            // not really necessary to normalize id and superclass because they are identifiers
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

        case "TaggedTemplateExpression": {
            const resultTag = normalize(obj.tag, obj);
            const resultQuasi = normalize(obj.quasi, obj);
            const resultData = [resultTag, resultQuasi]
            return normTaggedTemplateExpression(obj, resultData);
        }

        case "TemplateLiteral": {
            const resultExpressions = mapReduce(obj.expressions, obj);
            return normTemplateLiteral(obj, resultExpressions, parent);
        }

        case "MemberExpression": {
            const resultObject = normalize(obj.object, obj);
            const resultProperty = normalize(obj.property, obj);

            const resultData = [
                resultObject,
                resultProperty
            ];
            return normMemberExpression(obj, resultData, parent);
        }

        case "NewExpression":
        case "CallExpression": {
            const resultCallee = normalize(obj.callee, obj);
            const resultArguments = mapReduce(obj.arguments, obj);

            resultArguments.unshift(resultCallee);
            return normCallExpression(obj, resultArguments, parent);
        }

        case "UpdateExpression":
        case "UnaryExpression": {
            const resultData = [normalize(obj.argument, obj)];
            return normUpdateExpression(obj, resultData);
        }

        case "AwaitExpression":
        case "SpreadElement":
        case "RestElement":
        case "YieldExpression": {
            const resultData = [normalize(obj.argument, obj)];
            return normAwaitYieldExpression(obj, resultData);
        }

        case "LogicalExpression":
        case "BinaryExpression": {
            const resultLeft = normalize(obj.left, obj);
            const resultRight = normalize(obj.right, obj);

            const resultData = [
                resultLeft,
                resultRight
            ];
            return normBinaryExpression(obj, resultData, parent);
        }

        case "ConditionalExpression": {
            const resultTest = normalize(obj.test, obj);
            const resultConsequent = normalize(obj.consequent, obj);
            const resultAlternate = normalize(obj.alternate, obj);

            const resultData = [
                resultTest,
                resultConsequent,
                resultAlternate
            ];
            return normConditionalExpression(obj, resultData, parent);
        }

        case "AssignmentExpression": {
            const resultLeft = normalize(obj.left, obj);
            const resultRight = normalize(obj.right, obj);

            const resultData = [
                resultLeft,
                resultRight
            ];
            return normAssignmentExpressions(obj, resultData, parent);
        }

        case "SequenceExpression": {
            const resultData = mapReduce(obj.expressions, obj);
            return normSequenceExpression(obj, resultData);
        }

        case "ArrayPattern": {
            const resultData = mapReduce(obj.elements, obj);
            return normArrayPattern(obj, resultData, parent);
        }

        case "AssignmentPattern": {
            const resultLeft = normalize(obj.left, obj);
            const resultRight = normalize(obj.right, obj);

            const resultData = [
                resultLeft,
                resultRight
            ];
            return normAssignmentPattern(obj, resultData);
        }

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
                expr: null
            };
        }

        case "WhileStatement": {
            const resultTest = normalize(obj.test, obj);
            const resultBody = normalize(obj.body, obj);

            const resultData = [
                resultTest,
                resultBody
            ];
            return normWhileStatement(obj, resultData);
        }

        case "DoWhileStatement": {
            const resultTest = normalize(obj.test, obj);
            const resultBody = normalize(obj.body, obj);

            const resultData = [
                resultTest,
                resultBody
            ];
            return normDoWhileStatement(obj, resultData);
        }

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

        case "ForInStatement":
        case "ForOfStatement": {
            const resultLeft = normalize(obj.left, obj);
            const resultRight = normalize(obj.right, obj);
            const resultBody = normalize(obj.body, obj);

            const resultData = [
                resultLeft,
                resultRight,
                resultBody
            ];
            return normForInStatement(obj, resultData);
        }

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
                resultAlternate
            ];
            return normIfStatement(obj, resultData);
        }

        case "LabeledStatement": {
            const resultLabel = normalize(obj.label, obj);
            const resultBody = normalize(obj.body, obj);
            const resultData = [resultLabel, resultBody];
            return normLabeledStatement(obj, resultData);
        }

        case "ReturnStatement":
        case "ThrowStatement": {
            const resultData = [normalize(obj.argument, obj)];
            return normReturnStatement(obj, resultData);
        }

        case "SwitchStatement": {
            const resultDiscriminant = normalize(obj.discriminant, obj);
            const resultTests = obj.cases.map((switchCase) => normalize(switchCase.test, switchCase));
            const resultConsequents = obj.cases.map((switchCase) => mapReduce(switchCase.consequent, switchCase));
            return normSwitchStatement(obj, resultDiscriminant, resultTests, resultConsequents);
        }

        case "TryStatement": {
            const resultBlock = normalize(obj.block, obj);
            const resultHandler = normalize(obj.handler, obj);
            const resultFinalizer = normalize(obj.finalizer, obj);

            const resultData = [
                resultBlock,
                resultHandler,
                resultFinalizer
            ];
            return normTryStatement(obj, resultData);
        }

        case "CatchClause": {
            const resultParam = normalize(obj.param, obj);
            const resultBlock = normalize(obj.body, obj);

            const resultData = [resultParam, resultBlock];
            return normCatchClause(obj, resultData);
        }

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

        case "WithStatement": {
            const resultObject = normalize(obj.object, obj);
            const resultBody = normalize(obj.body, obj);

            const resultData = [resultObject, resultBody];
            return normWithStatement(obj, resultData);
        }

        case "ClassDeclaration": {
            // not really necessary to normalize id and superclass because they are identifiers
            const resultId = normalize(obj.id, obj);
            const resultSuperClass = normalize(obj.superClass, obj);
            const resultBody = normalize(obj.body, obj);

            const resultData = [resultId, resultSuperClass, resultBody];
            return normClassDeclaration(obj, resultData);
        }

        case "ImportDeclaration": {
            return normSimpleStatement(obj);
        }

        case "ExportAllDeclaration": {
            return normSimpleStatement(obj)
        }

        case "ExportDefaultDeclaration":
        case "ExportNamedDeclaration": {
            const resultDeclaration = normalize(obj.declaration, obj);

            return normExportDeclaration(obj, [resultDeclaration]);
        }

        default:
            throw Error(`Unknown type ${obj.type} to normalize.`);
    }
}
