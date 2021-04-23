const { Node, Edge, Graph } = require('./graph');

module.exports.cfg_builder = function(ast_graph) {
    this._g = ast_graph;
    self = this;

    this.defaultNode = (obj, children) => {
        const node = this._g.nodes.get(obj._id);
        return {
            root: node,
            exit: node,
        };
    };

    return {
        graph: () => self._g,
        visit: (obj, children) => {
            if (!obj) {
                return null;
            }
            
            let node_obj = null;        
            let previous_node = null;
            switch (obj.type) {
                // Scripts
                case "Program": {
                    let _start = self._g.addNode('_main_start');
                    let _end = self._g.addNode('_main_end');

                    node_obj = self._g.nodes.get(obj._id);

                    previous_node = _start;
                    children.forEach(child_obj => {
                        const { root, exit } = child_obj;
                        self._g.addEdge(previous_node.id, root.id, { type: 'CFG' });
                        previous_node = exit;
                    });
                    self._g.addEdge(previous_node.id, _end.id, { type: 'CFG' });
                    return self.defaultNode(obj, children);
                }
            
                // // Expressions
                // case "ArrayExpression":
                //     break;
            
                // case "ObjectExpression":
                //     break;
                
                // case "Property": {
                //     break;
                // }
            
                // case "MemberExpression": {
                //     break;
                // }
            
                // case "CallExpression":
                // case "NewExpression": {
                //     break;
                // }
            
                // case "UpdateExpression":
                // case "UnaryExpression":
                //     new_obj = copyObj(obj);
                //     delete new_obj.argument;
                //     new_node = self._g.addNode(obj.type, new_obj);

                //     let [argument] = children;
                //     self._g.addEdge(new_node.id, argument.id, { type: 'AST', label: 'argument'})
                //     break;
            
                // case "BinaryExpression":
                // case "LogicalExpression":
                // case "AssignmentExpression": {
                //     break;
                // }
            
                // case "SequenceExpression":
                //     break;
            
                // Statements and Declarations
                case "BlockStatement": {
                    node_obj = self._g.nodes.get(obj._id);
                    
                    previous_node = node_obj;
                    children.forEach(child_obj => {
                        const { root, exit } = child_obj;
                        self._g.addEdge(previous_node.id, root.id, { type: 'CFG' });
                        previous_node = exit;
                    });
                    
                    return {
                        root: node_obj,
                        exit: previous_node,
                    };
                }
            
                // case "DoWhileStatement":
                // case "WhileStatement": {
                //     break;
                // }
            
                // case "ExpressionStatement":
                //     new_obj = copyObj(obj);
                //     delete new_obj.expression;
                //     new_node = self._g.addNode(obj.type, new_obj);

                //     let [expression] = children;

                //     self._g.addEdge(new_node.id, expression.id, { type: 'AST', label: 'expression'});
                //     break;
            
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
                    node_obj = self._g.nodes.get(obj._id);

                    let [node_id, node_body] = children;

                    let name = node_id ? `${node_obj.id}_${node_id.root.obj.name}` : `${node_obj.id}_anon`;

                    let _start = self._g.addNode(`_${name}_start`);
                    let _end = self._g.addNode(`_${name}_end`);

                    self._g.addEdge(_start.id, node_body.root.id, { type: 'CFG' });
                    self._g.addEdge(node_body.exit.id, _end.id, { type: 'CFG' });
                    return self.defaultNode(obj, children);
                }
            
                case "IfStatement":
                case "ConditionalExpression": {
                    node_obj = self._g.nodes.get(obj._id);

                    let [test, consequent, alternate] = children;

                    let _end_if = self._g.addNode(`_${node_obj.id}_end_if`);

                    self._g.addEdge(node_obj.id, test.root.id, { type: 'CFG', label: 'test'});
                    self._g.addEdge(test.exit.id, consequent.root.id, { type: 'CFG', label: 'TRUE'});
                    self._g.addEdge(consequent.exit.id, _end_if.id, { type: 'CFG' });

                    if (alternate) {
                        self._g.addEdge(test.exit.id, alternate.root.id, { type: 'CFG', label: 'FALSE'});
                        self._g.addEdge(alternate.exit.id, _end_if.id, { type: 'CFG' });
                    } else {
                        self._g.addEdge(test.exit.id, _end_if.id, { type: 'CFG', label: 'FALSE'});
                    }
                    return {
                        root: node_obj,
                        exit: _end_if,
                    };
                }
            
                // case "ReturnStatement":
                // case "ThrowStatement":
                //     break;
            
                // case "SwitchStatement": {
                //     break;
                // }
        
                // case "SwitchCase": {
                //     break;
                // }
            
                // case "VariableDeclaration": {
                //     new_obj = copyObj(obj);
                //     delete new_obj.declarations;
                //     new_node = self._g.addNode(obj.type, new_obj);

                //     for(let i = 0; i < children.length; i++) {
                //         self._g.addEdge(new_node.id, children[i].id, { type: 'AST', label: i+1});
                //     }
                //     break;
                // }
                
                // case "VariableDeclarator": {
                //     new_obj = copyObj(obj);
                //     delete new_obj.id;
                //     delete new_obj.init;
                //     new_node = self._g.addNode(obj.type, new_obj);

                //     let [id, init] = children;
                //     self._g.addEdge(new_node.id, id.id, { type: 'AST', label: 'id'});
                //     self._g.addEdge(new_node.id, init.id, { type: 'AST', label: 'init'});
                //     break;
                // }
            
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
                    return self.defaultNode(obj, children);
            }
        }
    };
};