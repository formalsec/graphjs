const { Node, Edge, Graph } = require('./graph');

module.exports.ast_builder = function() {
    this._g = new Graph();
    self = this;

    return {
        graph: () => self._g,
        visit: (obj, children) => {
            if (!obj) {
                return null;
            }
            
            let obj_node = null;
            switch (obj.type) {
                // Scripts
                case "Program":
                    obj_node = self._g.addNode(obj.type, obj);

                    for(let i = 0; i < children.length; i++) {
                        self._g.addEdge(obj_node.id, children[i].id, { type: 'AST', label: i+1});
                    }
                    break;
            
                // // Expressions
                // case "ArrayExpression":
                //     break;
            
                case "ObjectExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    for(let i = 0; i < children.length; i++) {
                        self._g.addEdge(obj_node.id, children[i].id, { type: 'AST', label: i+1});
                    }
                    break;
                }
                
                case "Property": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [key, computed] = children;
                    self._g.addEdge(obj_node.id, key.id, { type: 'AST', label: 'key' });
                    self._g.addEdge(obj_node.id, computed.id, { type: 'AST', label: 'computed' });
                    break;
                }
            
                case "MemberExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [object, property] = children;

                    self._g.addEdge(obj_node.id, object.id, { type: 'AST', label: 'object' });
                    self._g.addEdge(obj_node.id, property.id, { type: 'AST', label: 'property' });
                    break;
                }
            
                case "CallExpression":
                case "NewExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let callee = children[0];
                    let arguments = children.slice(1);

                    self._g.addEdge(obj_node.id, callee.id, { type: 'AST', label: 'callee' });

                    for(let i = 0; i < arguments.length; i++) {
                        self._g.addEdge(obj_node.id, arguments[i].id, { type: 'AST', label: i+1});
                    }

                    break;
                }
            
                case "UpdateExpression":
                case "UnaryExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [argument] = children;
                    self._g.addEdge(obj_node.id, argument.id, { type: 'AST', label: 'argument'});
                    break;
                }
            
                case "BinaryExpression":
                case "LogicalExpression":
                case "AssignmentExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [left, right] = children;
                    self._g.addEdge(obj_node.id, left.id, { type: 'AST', label: 'left'});
                    self._g.addEdge(obj_node.id, right.id, { type: 'AST', label: 'right'})
                    break;
                }
            
                // case "SequenceExpression":
                //     break;
            
                // Statements and Declarations
                case "BlockStatement": {
                    obj_node = self._g.addNode(obj.type, obj);

                    for(let i = 0; i < children.length; i++) {
                        self._g.addEdge(obj_node.id, children[i].id, { type: 'AST', label: i+1});
                    }
                    break;
                }
            
                // case "DoWhileStatement":
                // case "WhileStatement": {
                //     break;
                // }
            
                case "ExpressionStatement":
                    obj_node = self._g.addNode(obj.type, obj);

                    let [expression] = children;

                    self._g.addEdge(obj_node.id, expression.id, { type: 'AST', label: 'expression'});
                    break;
            
                // case "ForStatement": {
                //     break;
                // }
            
                // case "ForInStatement": {
                //     break;
                // }
            
                case "ArrowFunctionExpression":
                case "FunctionDeclaration":
                case "FunctionExpression":
                case "LabeledStatement": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [node_id, node_body] = children;

                    if (node_id) {
                        self._g.addEdge(obj_node.id, node_id.id, { type: 'AST', label: 'id'});
                    }

                    self._g.addEdge(obj_node.id, node_body.id, { type: 'AST', label: 'body'});
                    break;
                }
            
                case "IfStatement":
                case "ConditionalExpression": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [test, consequent, alternate] = children;

                    self._g.addEdge(obj_node.id, test.id, { type: 'AST', label: 'test'});
                    self._g.addEdge(obj_node.id, consequent.id, { type: 'AST', label: 'consequent'});

                    if (alternate) {
                        self._g.addEdge(obj_node.id, alternate.id, { type: 'AST', label: 'alternate'});
                    }
                    break;
                }
            
                case "ReturnStatement":
                case "ThrowStatement": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [argument] = children;

                    if (argument) {
                        self._g.addEdge(obj_node.id, argument.id, { type: 'AST', label: 'argument'});
                    }
                    break;
                }
            
                // case "SwitchStatement": {
                //     break;
                // }
        
                // case "SwitchCase": {
                //     break;
                // }
            
                case "VariableDeclaration": {
                    // obj_node = children[0];
                    // break;
                    
                    obj_node = self._g.addNode(obj.type, obj);

                    for(let i = 0; i < children.length; i++) {
                        self._g.addEdge(obj_node.id, children[i].id, { type: 'AST', label: i+1});
                    }
                    break;
                }
                
                case "VariableDeclarator": {
                    obj_node = self._g.addNode(obj.type, obj);

                    let [id_node, init_node] = children;
                    self._g.addEdge(obj_node.id, id_node.id, { type: 'AST', label: 'id'});
                    self._g.addEdge(obj_node.id, init_node.id, { type: 'AST', label: 'init'});
                    break;
                }
            
                // case "WithStatement": {
                //     break;
                // }
            
                // case "TryStatement": {
                //     break;
                // }
            
                // case "CatchClause": {
                //     break;
                // }
            
                default:
                    obj_node = self._g.addNode(obj.type, obj);
            }

            return obj_node;
        }
    };
};