const { Graph } = require('./graph');

function buildAST(obj) {
    const graph = new Graph();
    traverse(obj);
    return graph;

    function traverse(obj) {
        function mapReduce(arr) {
            return arr.map((item) => traverse(item));
        }
        
        if (obj === null) {
            return null;
        }
        
        let obj_node = null;
        switch (obj.type) {
            //
            // Scripts
            //
            case "Program": {
                resultData = mapReduce(obj.body);
                obj_node = graph.addNode(obj.type, obj);
                graph.add_start_nodes('AST', obj_node);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }

            case "BlockStatement": {
                resultData = mapReduce(obj.body);
                obj_node = graph.addNode(obj.type, obj);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }
    
            //
            // Expressions
            //
            // case "ArrayExpression":
            //     resultData = mapReduce(obj.elements);
            //     break;
    
            case "ObjectExpression": {
                resultData = mapReduce(obj.properties);
                obj_node = graph.addNode(obj.type, obj);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }

            case "Property": {
                const key = traverse(obj.key);
                const computed = traverse(obj.value);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, key.id, { type: 'AST', label: 'key' });
                graph.addEdge(obj_node.id, computed.id, { type: 'AST', label: 'computed' });
                break;
            }
    
            case "MemberExpression": {
                const object = traverse(obj.object);
                const property = traverse(obj.property);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, object.id, { type: 'AST', label: 'object' });
                graph.addEdge(obj_node.id, property.id, { type: 'AST', label: 'property' });
                break;
            }
    
            case "CallExpression":
            case "NewExpression": {
                const callee = traverse(obj.callee);
                const arguments = mapReduce(obj.arguments);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, callee.id, { type: 'AST', label: 'callee' });

                for(let i = 0; i < arguments.length; i++) {
                    graph.addEdge(obj_node.id, arguments[i].id, { type: 'AST', label: i+1});
                }
                break;
            }
    
            case "UpdateExpression":
            case "UnaryExpression": {
                const argument = traverse(obj.argument);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, argument.id, { type: 'AST', label: 'argument'});
                break;
            }
    
            case "BinaryExpression":
            case "LogicalExpression":
            case "AssignmentExpression": {
                const left = traverse(obj.left);
                const right = traverse(obj.right);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, left.id, { type: 'AST', label: 'left'});
                graph.addEdge(obj_node.id, right.id, { type: 'AST', label: 'right'})
                break;
            }
    
            // case "SequenceExpression":
            //     resultData = mapReduce(obj.expressions);
            //     break;
    
            //
            // Statements and Declarations
            //   
            // case "DoWhileStatement":
            // case "WhileStatement": {
            //     const resultTest = traverse(callback, obj.test);
            //     const resultBody = traverse(callback, obj.body);
    
            //     resultData = [
            //     resultTest,
            //     resultBody
            //     ];
            //     break;
            // }
    
            case "ExpressionStatement": {
                const expression = traverse(obj.expression);
                obj_node = graph.addNode(obj.type, obj);
                graph.addEdge(obj_node.id, expression.id, { type: 'AST', label: 'expression'});
                break;
            }
    
            // case "ForStatement": {
            //     const resultInit = traverse(callback, obj.init);
            //     const resultTest = traverse(callback, obj.test);
            //     const resultUpdate = traverse(callback, obj.update);
            //     const resultBody = traverse(callback, obj.body);
    
            //     resultData = [
            //     resultInit,
            //     resultTest,
            //     resultUpdate,
            //     resultBody
            //     ];
            //     break;
            // }
    
            // case "ForInStatement": {
            //     const resultLeft = traverse(callback, obj.left);
            //     const resultRight = traverse(callback, obj.right);
            //     const resultBody = traverse(callback, obj.body);
    
            //     resultData = [
            //     resultLeft,
            //     resultRight,
            //     resultBody
            //     ];
            //     break;
            // }
    
            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                const node_id = traverse(obj.id);
                const node_body = traverse(obj.body);
                obj_node = graph.addNode(obj.type, obj);

                if (node_id) {
                    graph.addEdge(obj_node.id, node_id.id, { type: 'AST', label: 'id'});
                }

                graph.addEdge(obj_node.id, node_body.id, { type: 'AST', label: 'body'});
                break;
            }
    
            case "IfStatement":
            case "ConditionalExpression": {
                const test = traverse(obj.test);
                const consequent = traverse(obj.consequent);
                const alternate = traverse(obj.alternate);
                
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, test.id, { type: 'AST', label: 'test'});
                graph.addEdge(obj_node.id, consequent.id, { type: 'AST', label: 'consequent'});

                if (alternate) {
                    graph.addEdge(obj_node.id, alternate.id, { type: 'AST', label: 'alternate'});
                }
                break;
            }
    
            case "ReturnStatement":
            case "ThrowStatement": {
                const argument = traverse(obj.argument);
                obj_node = graph.addNode(obj.type, obj);

                if (argument) {
                    graph.addEdge(obj_node.id, argument.id, { type: 'AST', label: 'argument'});
                }
                break;
            }
    
            // case "SwitchStatement": {
            //     const resultDiscriminant = traverse(callback, obj.discriminant);
            //     const resultCases = mapReduce(obj.cases);
    
            //     resultCases.unshift(resultDiscriminant);
            //     resultData = resultCases;
            //     break;
            // }
            // case "SwitchCase": {
            //     const resultTest = traverse(callback, obj.test);
            //     const resultConsequent = mapReduce(obj.consequent);
    
            //     resultConsequent.unshift(resultTest);
            //     resultData = resultConsequent;
            //     break;
            // }
    
            case "VariableDeclaration": {
                resultData = mapReduce(obj.declarations);
                obj_node = graph.addNode(obj.type, obj);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }

            case "VariableDeclarator": {
                const id_node = traverse(obj.id);
                const init_node = traverse(obj.init);
                obj_node = graph.addNode(obj.type, obj);

                graph.addEdge(obj_node.id, id_node.id, { type: 'AST', label: 'id'});

                if (init_node) {
                    graph.addEdge(obj_node.id, init_node.id, { type: 'AST', label: 'init'});
                }
                break;
            }
    
            // case "WithStatement": {
            //     const resultObject = traverse(callback, obj.object);
            //     const resultBody = traverse(callback, obj.body);
    
            //     resultData = [ resultObject, resultBody ];
            //     break;
            // }
    
            // case "TryStatement": {
            //     const resultBlock = traverse(callback, obj.block);
            //     const resultHandler = traverse(callback, obj.handler);
            //     const resultFinalizer = traverse(callback, obj.finalizer);
    
            //     resultData = [
            //     resultBlock,
            //     resultHandler,
            //     resultFinalizer
            //     ];
            //     break;
            // }
    
            // case "CatchClause": {
            //     const resultParam = traverse(callback, obj.param);
            //     const resultBlock = traverse(callback, obj.body);
    
            //     resultData = [ resultParam, resultBlock ];
            //     break;
            // }
    
            default:
                obj_node = graph.addNode(obj.type, obj);
        }
    
        return obj_node;
    }
}


module.exports = { buildAST };