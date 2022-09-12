/**
 * Function that modifies an Esprima AST.
 * For every object found it calls the provided function **f**, and reduces it
 * and its children's return with **_f**
 *
 * @param {Function} f
 * Mapping function called passing the param **p**. Should return object of the
 * same type as **a**.
 * @param {Function} _f
 * Reducing function called passing the params **p** and **a**. Should return
 * object of the same type as **a**
 * @param {Object} p
 * An Esprima AST object representing an Expression, a Statement or a Script.
 * @param {Object} a
 * Accumulator of the reduce (applied to each node).
 * 
 * @returns an object which results from applying **f** to each node and 
 * reducing the results with **_f**
 */
function map_reduceJS(f, _f, p, a) {
	if (!p) return a;

	switch (p.type) {
		case 'Program':
			/** Return the accumulator of each of the elements in body */
			var body = p.body.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(body)).reduce(_f, a);

		case 'ExpressionStatement':
			var new_expression = map_reduceJS(f, _f, p.expression, a);
			return ([f(p)].concat(new_expression)).reduce(_f, a);

		case 'Literal':
			return [f(p)].reduce(_f, a);

		case 'Identifier':
			return [f(p)].reduce(_f, a);

		case 'AssignmentExpression':
		case 'BinaryExpression':
		case 'LogicalExpression':
			var left = map_reduceJS(f, _f, p.left, a);
			var right = map_reduceJS(f, _f, p.right, a);
			return ([f(p)].concat(left, right)).reduce(_f, a);

		case 'MemberExpression':
			var object = map_reduceJS(f, _f, p.object, a);
			var property = map_reduceJS(f, _f, p.property, a);
			return ([f(p)].concat(object, property)).reduce(_f, a);

		case 'CallExpression':
		case 'NewExpression':
			var callee = map_reduceJS(f, _f, p.callee, a);
			var args = p.arguments.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(callee, args)).reduce(_f, a);

		case 'ObjectExpression':
			var properties = p.properties.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(properties)).reduce(_f, a);

		case 'DebuggerStatement':
		case 'ThisExpression': return f(p);

		case 'UnaryExpression':
			var argument = map_reduceJS(f, _f, p.argument, a);
			return ([f(p)].concat(argument)).reduce(_f, a);

		case 'BlockStatement':
			var body = p.body.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(body)).reduce(_f, a);

		case 'DoWhileStatement':
		case 'WhileStatement':
			var test = map_reduceJS(f, _f, p.test, a);
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(body)).reduce(_f, a);

		case 'ConditionalExpression':
		case 'IfStatement':
			var test = map_reduceJS(f, _f, p.test, a);
			var consequent = map_reduceJS(f, _f, p.consequent, a);
			var alternate = map_reduceJS(f, _f, p.alternate, a);
			return ([f(p)].concat(test, consequent, alternate)).reduce(_f, a);

		case 'ThrowStatement':
		case 'ReturnStatement':
			var argument = map_reduceJS(f, _f, p.argument, a);
			return ([f(p)].concat(argument)).reduce(_f, a);

		case 'FunctionDeclaration':
		case 'FunctionExpression':
			var params = p.params.map((s) => map_reduceJS(f, _f, s, a));
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(params, body)).reduce(_f, a);

		case 'VariableDeclaration':
			var declarations = p.declarations.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(declarations)).reduce(_f, a);

		case 'ArrayExpression':
			var elements = p.elements.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(elements)).reduce(_f, a)

		case 'ContinueStatement':
		case 'BreakStatement':
			return [f(p)].reduce(_f, a);

		case 'CatchClause':
			var param = map_reduceJS(f, _f, p.param, a);
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(param, body)).reduce(_f, a);

		case 'ForStatement':
			var init = map_reduceJS(f, _f, p.init, a);
			var test = map_reduceJS(f, _f, p.test, a);
			var update = map_reduceJS(f, _f, p.update, a);
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(init, test, update, body)).reduce(_f, a);

		case 'ForInStatement':
			var left = map_reduceJS(f, _f, p.left, a);
			var right = map_reduceJS(f, _f, p.right, a);
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(left, right, body)).reduce(_f, a);

		case 'LabeledStatement':
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(body)).reduce(_f, a);

		case 'Property':
			var key = map_reduceJS(f, _f, p.key, a);
			var value = map_reduceJS(f, _f, p.value, a);
			return ([f(p)].concat(key, value)).reduce(_f, a);

		case 'SequenceExpression':
			var expressions = p.expressions.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(expressions)).reduce(_f, a);

		case 'SwitchStatement':
			var discriminant = map_reduceJS(f, _f, p.discriminant);
			var cases = p.cases.map((s) => map_reduceJS(f, _f, s, a));
			return ([f(p)].concat(discriminant, cases)).reduce(_f, a);

		case 'SwitchCase':
			var test = map_reduceJS(f, _f, p.test, a);
			var consequent = map_reduceJS(f, _f, p.consequent, a);
			return ([f(p)].concat(test, consequent)).reduce(_f, a);

		case 'TryStatement':
			var block = map_reduceJS(f, _f, p.block, a);
			var handler = map_reduceJS(f, _f, p.handler, a);
			var finalizer = map_reduceJS(f, _f, p.finalizer, a);
			return ([f(p)].concat(block, handler, finalizer)).reduce(_f, a);

		case 'VariableDeclarator':
			var id = map_reduceJS(f, _f, p.id, a);
			var init = map_reduceJS(f, _f, p.init, a);
			return ([f(p)].concat(id, init)).reduce(_f, a);

		case 'WithStatement':
			var object = map_reduceJS(f, _f, p.object, a);
			var body = map_reduceJS(f, _f, p.body, a);
			return ([f(p)].concat(object, body)).reduce(_f, a);

		default: return [f(p)].reduce(_f, a);
	}
}

module.exports = map_reduceJS;