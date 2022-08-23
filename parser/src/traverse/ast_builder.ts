import * as estree from "estree";
import { copyObj } from "../utils/utils";
import { Graph } from "./graph/graph";
import { GraphNode } from "./graph/node";

function buildAST(originalObj: estree.Program) {
    const graph = new Graph(null);

    function traverse(obj: estree.Node, parentNode: GraphNode | null): GraphNode {
        function mapReduce(arr: estree.Node[], anotherParentNode: GraphNode | null): GraphNode[] {
            return arr.map((item) => traverse(item, anotherParentNode));
        }

        // if (obj === null) {
        //     return null;
        // }

        switch (obj.type) {
        //
        // Scripts
        //
        case "Program": {
            const objNode = graph.addNode(obj.type, obj);
            graph.addStartNodes("AST", objNode);

            const resultData = mapReduce(obj.body, objNode);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < resultData.length; i++) {
                graph.addEdge(objNode.id, resultData[i].id, { type: "AST", label: i + 1 });
            }
            return objNode;
        }

        case "BlockStatement": {
            const resultData = mapReduce(obj.body, null);

            const objNode = graph.addNode(obj.type, obj);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < resultData.length; i++) {
                graph.addEdge(objNode.id, resultData[i].id, { type: "AST", label: "stmt", stmtIndex: i + 1 });
            }
            return objNode;
        }

        //
        // Expressions
        //
        case "ArrayExpression": {
            const objNode = graph.addNode(obj.type, obj);
            const elements: (estree.Expression | estree.SpreadElement)[] = [];
            obj.elements.forEach((e) => {
                if (e !== null) elements.push(e);
            });

            const resultData = mapReduce(elements, objNode);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < resultData.length; i++) {
                graph.addEdge(objNode.id, resultData[i].id, { type: "AST", label: "element", elementIndex: i });
            }

            return objNode;
        }

        case "ObjectExpression": {
            const objNode = graph.addNode(obj.type, obj);

            const resultData = mapReduce(obj.properties, objNode);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < resultData.length; i++) {
                graph.addEdge(objNode.id, resultData[i].id, { type: "AST", label: i + 1 });
            }
            return objNode;
        }

        case "Property": {
            const objNode = graph.addNode(obj.type, obj);

            const key = traverse(obj.key, objNode);
            const value = traverse(obj.value, objNode);

            graph.addEdge(objNode.id, key.id, { type: "AST", label: "key" });
            graph.addEdge(objNode.id, value.id, { type: "AST", label: "value" });
            return objNode;
        }

        case "MemberExpression": {
            const objNode = graph.addNode(obj.type, obj);

            const object = traverse(obj.object, objNode);
            const property = traverse(obj.property, objNode);

            graph.addEdge(objNode.id, object.id, { type: "AST", label: "object" });
            graph.addEdge(objNode.id, property.id, { type: "AST", label: "property" });
            return objNode;
        }

        case "CallExpression":
        case "NewExpression": {
            const objNode = graph.addNode(obj.type, obj);

            const callee = traverse(obj.callee, objNode);
            const args = mapReduce(obj.arguments, objNode);

            graph.addEdge(objNode.id, callee.id, { type: "AST", label: "callee" });

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < args.length; i++) {
                graph.addEdge(objNode.id, args[i].id, { type: "AST", label: "arg", argumentIndex: i + 1 });
            }
            return objNode;
        }

        case "UpdateExpression":
        case "UnaryExpression": {
            const objNode = graph.addNode(obj.type, obj);
            const argument = traverse(obj.argument, objNode);
            graph.addEdge(objNode.id, argument.id, { type: "AST", label: "argument" });
            return objNode;
        }

        case "BinaryExpression":
        case "LogicalExpression":
        case "AssignmentExpression": {
            const objNode = graph.addNode(obj.type, obj);

            const left = traverse(obj.left, objNode);
            const right = traverse(obj.right, objNode);

            graph.addEdge(objNode.id, left.id, { type: "AST", label: "left" });
            graph.addEdge(objNode.id, right.id, { type: "AST", label: "right" });
            return objNode;
        }

        // case "SequenceExpression":
        //     const resultData = mapReduce(obj.expressions);
        //     return objNode;

        //
        // Statements and Declarations
        //
        case "DoWhileStatement":
        case "WhileStatement": {
            const objNode = graph.addNode(obj.type, obj);

            const test = traverse(obj.test, objNode);
            const body = traverse(obj.body, objNode);

            graph.addEdge(objNode.id, test.id, { type: "AST", label: "test" });

            if (Array.isArray(body)) {
                const bodyNode = graph.addNode(obj.body.type, obj.body);
                // eslint-disable-next-line no-plusplus
                for (let i = 0; i < body.length; i++) {
                    graph.addEdge(bodyNode.id, body[i].id, { type: "AST", label: i + 1 });
                }
                graph.addEdge(objNode.id, bodyNode.id, { type: "AST", label: "body" });
            } else {
                graph.addEdge(objNode.id, body.id, { type: "AST", label: "body" });
            }

            // graph.addEdge(objNode.id, body.id, { type: "AST", label: "body" });
            return objNode;
        }

        case "ExpressionStatement": {
            const objNode = graph.addNode(obj.type, obj);

            const expression = traverse(obj.expression, objNode);
            graph.addEdge(objNode.id, expression.id, { type: "AST", label: "expression" });
            return objNode;
        }

        case "Identifier": {
            const objNode = graph.addNode(obj.type, obj);
            objNode.identifier = obj.name;
            return objNode;
        }

        case "Literal": {
            const rawObj = copyObj(obj);
            if (obj.raw) {
                rawObj.name = obj.raw;
            }
            const objNode = graph.addNode(obj.type, rawObj);
            return objNode;
        }

        case "TemplateLiteral": {
            const objNode = graph.addNode(obj.type, obj);

            const args = mapReduce(obj.expressions, objNode);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < args.length; i++) {
                graph.addEdge(objNode.id, args[i].id, { type: "AST", label: "expression", expressionIndex: i + 1 });
            }
            return objNode;
        }

        case "LabeledStatement": {
            const objNode = graph.addNode(obj.type, obj);
            objNode.identifier = obj.label.name;

            const nodeBodyStmts = traverse(obj.body, objNode); // must be blockstatement
            graph.addEdge(objNode.id, nodeBodyStmts.id, { type: "AST", label: "block" });
            return objNode;
        }

        case "ArrowFunctionExpression":
        case "FunctionDeclaration":
        case "FunctionExpression": {
            const objNode = graph.addNode(obj.type, obj);

            if (parentNode?.identifier) {
                objNode.functionName = parentNode?.identifier;
            }

            if (obj.type === "ArrowFunctionExpression") {
                objNode.identifier = "anon";
            } else {
                objNode.identifier = obj.id ? obj.id.name : "anon";
            }
            const nodeParams = obj?.params.map((param) => traverse(param, objNode));

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < nodeParams.length; i++) {
                graph.addEdge(objNode.id, nodeParams[i].id, { type: "AST", label: "param", paramIndex: i + 1 });
            }

            const nodeBodyStmts = traverse(obj.body, objNode); // must be blockstatement
            graph.addEdge(objNode.id, nodeBodyStmts.id, { type: "AST", label: "block" });
            return objNode;
        }

        case "IfStatement":
        case "ConditionalExpression": {
            const objNode = graph.addNode(obj.type, obj);

            const test = traverse(obj.test, objNode);
            const consequent = traverse(obj.consequent, objNode);
            const alternate = obj.alternate ? traverse(obj.alternate, objNode) : null;

            graph.addEdge(objNode.id, test.id, { type: "AST", label: "test" });

            if (Array.isArray(consequent)) {
                const consequentNode = graph.addNode(obj.consequent.type, obj.consequent);
                // eslint-disable-next-line no-plusplus
                for (let i = 0; i < consequent.length; i++) {
                    graph.addEdge(consequentNode.id, consequent[i].id, { type: "AST", label: i + 1 });
                }
                graph.addEdge(objNode.id, consequentNode.id, { type: "AST", label: "then" });
            } else {
                graph.addEdge(objNode.id, consequent.id, { type: "AST", label: "then" });
            }

            if (alternate) {
                const alternateType = obj.alternate?.type;
                if (Array.isArray(alternate)) {
                    const alternateNode = alternateType ? graph.addNode(alternateType, obj.alternate): graph.addNode("", obj.alternate);
                    // eslint-disable-next-line no-plusplus
                    for (let i = 0; i < alternate.length; i++) {
                        graph.addEdge(alternateNode.id, alternate[i].id, { type: "AST", label: i + 1 });
                    }
                    graph.addEdge(objNode.id, alternateNode.id, { type: "AST", label: "else" });
                } else {
                    graph.addEdge(objNode.id, alternate.id, { type: "AST", label: "else" });
                }
            }
            return objNode;
        }

        case "ReturnStatement":
        case "ThrowStatement": {
            const objNode = graph.addNode(obj.type, obj);

            const argument = obj.argument ? traverse(obj.argument, objNode): null;

            if (argument) {
                graph.addEdge(objNode.id, argument.id, { type: "AST", label: "argument" });
            }
            return objNode;
        }

        // case "SwitchStatement": {
        //     const resultDiscriminant = traverse(callback, obj.discriminant);
        //     const resultCases = mapReduce(obj.cases);

        //     resultCases.unshift(resultDiscriminant);
        //     const resultData = resultCases;
        //     return objNode;
        // }
        // case "SwitchCase": {
        //     const resultTest = traverse(callback, obj.test);
        //     const resultConsequent = mapReduce(obj.consequent);

        //     resultConsequent.unshift(resultTest);
        //     const resultData = resultConsequent;
        //     return objNode;
        // }

        case "VariableDeclaration": {
            const objNode = traverse(obj.declarations[0], parentNode);
            return objNode;
        }

        case "VariableDeclarator": {
            const objNode = graph.addNode(obj.type, obj);
            objNode.identifier = obj.id.type === "Identifier" ? obj.id.name : "";
            const initNode = obj.init ? traverse(obj.init, objNode) : null;

            // graph.addEdge(objNode.id, id_node.id, { type: "AST", label: 'id'});

            if (initNode) {
                graph.addEdge(objNode.id, initNode.id, { type: "AST", label: "init" });
            }
            return objNode;
        }

        // case "WithStatement": {
        //     const resultObject = traverse(callback, obj.object);
        //     const resultBody = traverse(callback, obj.body);

        //     const resultData = [ resultObject, resultBody ];
        //     return objNode;
        // }

        // case "TryStatement": {
        //     const resultBlock = traverse(callback, obj.block);
        //     const resultHandler = traverse(callback, obj.handler);
        //     const resultFinalizer = traverse(callback, obj.finalizer);

        //     const resultData = [
        //     resultBlock,
        //     resultHandler,
        //     resultFinalizer
        //     ];
        //     return objNode;
        // }

        // case "CatchClause": {
        //     const resultParam = traverse(callback, obj.param);
        //     const resultBlock = traverse(callback, obj.body);

        //     const resultData = [ resultParam, resultBlock ];
        //     return objNode;
        // }

        case "ThisExpression": {
            const newObj = copyObj(obj);
            newObj.name = "this";
            const objNode = graph.addNode(newObj.type, newObj);
            return objNode
        }

        default:
            const objNode = graph.addNode(obj.type, obj);
            return objNode;
        }
    }

    traverse(originalObj, null);
    return graph;
}

module.exports = { buildAST };
