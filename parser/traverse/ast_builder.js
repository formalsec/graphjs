const { Graph } = require('./graph');

function buildAST(obj) {
    const graph = new Graph();
    traverse(obj);
    return graph;

    function traverse(obj, parent_node) {
        function mapReduce(arr, parent_node) {
            return arr.map((item) => traverse(item, parent_node));
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
                obj_node = graph.addNode(obj.type, obj);
                graph.add_start_nodes('AST', obj_node);
                
                resultData = mapReduce(obj.body, obj_node);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }

            case "BlockStatement": {
                resultData = mapReduce(obj.body);
                // obj_node = mapReduce(obj.body, parent_node);

                obj_node = graph.addNode(obj.type, obj);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: 'stmt', stmt_index: i+1});
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
                obj_node = graph.addNode(obj.type, obj);
                
                resultData = mapReduce(obj.properties, obj_node);

                for(let i = 0; i < resultData.length; i++) {
                    graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                }
                break;
            }

            case "Property": {
                obj_node = graph.addNode(obj.type, obj);
                
                const key = traverse(obj.key, obj_node);
                const computed = traverse(obj.value, obj_node);

                graph.addEdge(obj_node.id, key.id, { type: 'AST', label: 'key' });
                graph.addEdge(obj_node.id, computed.id, { type: 'AST', label: 'computed' });
                break;
            }
    
            case "MemberExpression": {
                obj_node = graph.addNode(obj.type, obj);
                
                const object = traverse(obj.object, obj_node);
                const property = traverse(obj.property, obj_node);

                graph.addEdge(obj_node.id, object.id, { type: 'AST', label: 'object' });
                graph.addEdge(obj_node.id, property.id, { type: 'AST', label: 'property' });
                break;
            }
    
            case "CallExpression":
            case "NewExpression": {
                obj_node = graph.addNode(obj.type, obj);
                
                const callee = traverse(obj.callee, obj_node);
                const arguments = mapReduce(obj.arguments, obj_node);

                graph.addEdge(obj_node.id, callee.id, { type: 'AST', label: 'callee' });

                for(let i = 0; i < arguments.length; i++) {
                    graph.addEdge(obj_node.id, arguments[i].id, { type: 'AST', label: 'arg', argument_index: i+1});
                }
                break;
            }
    
            case "UpdateExpression":
            case "UnaryExpression": {
                obj_node = graph.addNode(obj.type, obj);
                
                const argument = traverse(obj.argument, obj_node);

                graph.addEdge(obj_node.id, argument.id, { type: 'AST', label: 'argument'});
                break;
            }
    
            case "BinaryExpression":
            case "LogicalExpression":
            case "AssignmentExpression": {
                obj_node = graph.addNode(obj.type, obj);
                
                const left = traverse(obj.left, obj_node);
                const right = traverse(obj.right, obj_node);

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
                obj_node = graph.addNode(obj.type, obj);
                
                const expression = traverse(obj.expression, obj_node);
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

            case "Identifier": {
                obj_node = graph.addNode(obj.type, obj);
                obj_node.identifier = obj.name;
                break;
            }
    
            case "ArrowFunctionExpression":
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "LabeledStatement": {
                obj_node = graph.addNode(obj.type, obj);
                obj_node.identifier = obj.id ? obj.id.name : `anon`;

                const node_params = obj.params.map(param => traverse(param, obj_node));
 
                for(let i = 0; i < node_params.length; i++) {
                    graph.addEdge(obj_node.id, node_params[i].id, { type: 'AST', label: 'param', param_index: i+1});
                }

                const node_body_stmts = traverse(obj.body, obj_node); // must be blockstatement
                graph.addEdge(obj_node.id, node_body_stmts.id, { type: 'AST', label: 'block' });
                // for(let i = 0; i < node_body_stmts.length; i++) {
                //     graph.addEdge(obj_node.id, node_body_stmts[i].id, { type: 'AST', label: i+1});
                // }

                break;
            }
    
            case "IfStatement":
            case "ConditionalExpression": {
                obj_node = graph.addNode(obj.type, obj);
                // obj_node = traverse(obj.test, obj_node);

                const test = traverse(obj.test, obj_node);
                const consequent = traverse(obj.consequent, obj_node);
                const alternate = traverse(obj.alternate, obj_node);
                
                graph.addEdge(obj_node.id, test.id, { type: 'AST', label: 'test'});

                if (Array.isArray(consequent)) {
                    const consequent_node = graph.addNode(obj.consequent.type, obj.consequent);
                    for(let i = 0; i < consequent.length; i++) {
                        graph.addEdge(consequent_node.id, consequent[i].id, { type: 'AST', label: i+1});
                    }
                    graph.addEdge(obj_node.id, consequent_node.id, { type: 'AST', label: 'then'});
                } else {
                    graph.addEdge(obj_node.id, consequent.id, { type: 'AST', label: 'then'});
                }

                if (alternate) {
                    if (Array.isArray(alternate)) {
                        const alternate_node = graph.addNode(obj.alternate.type, obj.alternate);
                        for(let i = 0; i < alternate.length; i++) {
                            graph.addEdge(alternate_node.id, alternate[i].id, { type: 'AST', label: i+1});
                        }
                        graph.addEdge(obj_node.id, alternate_node.id, { type: 'AST', label: 'else'});
                    } else {
                        graph.addEdge(obj_node.id, alternate.id, { type: 'AST', label: 'else'});
                    }
                }
                break;
            }
    
            case "ReturnStatement":
            case "ThrowStatement": {
                obj_node = graph.addNode(obj.type, obj);

                const argument = traverse(obj.argument, obj_node);

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
                obj_node = traverse(obj.declarations[0], parent_node);
                
                // obj_node = graph.addNode(obj.type, obj);
                // resultData = mapReduce(obj.declarations, obj_node); 
                // for(let i = 0; i < resultData.length; i++) {
                //     graph.addEdge(obj_node.id, resultData[i].id, { type: 'AST', label: i+1});
                // }
                break;
            }

            case "VariableDeclarator": {
                obj_node = graph.addNode(obj.type, obj);
                obj_node.identifier = obj.id.name;

                //const id_node = traverse(obj.id, obj_node);
                const init_node = traverse(obj.init, obj_node);

                // graph.addEdge(obj_node.id, id_node.id, { type: 'AST', label: 'id'});

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