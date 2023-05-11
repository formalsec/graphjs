/**
 * Function that modifies an Esprima AST.
 * For every object found it calls the provided function **f**, if the return is
 * null, it applies the function **fo** after exploring its children 
 * recursively and applyimg mapJS to them.
 *
 * @param {Function} f
 * Function called passing the param **p**.
 * Should return a mapping or null if the node's children need to be explored.
 * @param {Object} p
 * An Esprima AST object representing an Expression, a Statement or a Script.
 * @param {function} fo (optional)
 * Function called passing an Esprima AST. Should return the desired object.
 * 
 * @returns an object which results from applying f before the exploration of 
 * the children and fo after the exploration of the children
 */

function mapJS(f, p, fo) {
	if (!p) return p;

	if (fo === undefined) {
		fo = function (x) {return x};
	}

	var ret = f(p);
	if (ret !== null) {
		return ret;
	}

	switch (p.type) {
		case 'Program':
			var body = p.body.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				body: body,
				sourceType: p.sourceType
			})

		case 'ExpressionStatement':
			var new_expression = mapJS(f, p.expression, fo);
			return fo({
				type: p.type,
				expression: new_expression
			})

		case 'Literal':
			return fo({
				type: p.type,
				value: p.value,
				raw: p.raw
			})

		case 'Identifier':
			return fo({
				type: p.type,
				name: p.name
			})

		case 'AssignmentExpression':
		case 'BinaryExpression':
		case 'LogicalExpression':
			var left = mapJS(f, p.left, fo);
			var right = mapJS(f, p.right, fo);
			return fo({
				left: left,
				right: right,
				operator: p.operator,
				type: p.type
			})

		case 'MemberExpression':
			var object = mapJS(f, p.object, fo);
			var property = mapJS(f, p.property, fo);
			return fo({
				object: object,
				property: property,
				computed: p.computed,
				type: p.type
			})

		case 'CallExpression':
		case 'NewExpression':
			var callee = mapJS(f, p.callee, fo);
			var args = p.arguments.map((s) => mapJS(f, s, fo));
			return fo({
				callee: callee,
				arguments: args,
				type: p.type,
			})

		case 'ObjectExpression':
			var properties = p.properties.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				properties: properties
			})

		case 'DebuggerStatement':
		case 'ThisExpression': return fo({ type: p.type })

		case 'UnaryExpression':
			var argument = mapJS(f, p.argument);
			return fo({
				type: p.type,
				argument: argument,
				prefix: p.prefix,
				operator: p.operator
			})

		case 'BlockStatement':
			var body = p.body.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				body: body
			})

		case 'DoWhileStatement':
		case 'WhileStatement':
			var test = mapJS(f, p.test, fo);
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				test: test,
				body: body
			})

		case 'ConditionalExpression':
		case 'IfStatement':
			var test = mapJS(f, p.test, fo);
			var consequent = mapJS(f, p.consequent, fo);
			var alternate = mapJS(f, p.alternate, fo);
			return fo({
				type: p.type,
				test: test,
				consequent: consequent,
				alternate: alternate
			})

		case 'ThrowStatement':
		case 'ReturnStatement':
			var argument = mapJS(f, p.argument, fo);
			return fo({
				type: p.type,
				argument: argument
			})

		case 'FunctionDeclaration':
		case 'FunctionExpression':
		case 'ArrowFunctionExpression':
			var params = p.params.map((s) => mapJS(f, s, fo));
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				id: p.id,
				params: params,
				body: body,
				generator: p.generator,
				expression: p.expression,
				async: p.async

			})

		case 'VariableDeclaration':
			var declarations = p.declarations.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				declarations: declarations,
				kind: p.kind
			})

		case 'ArrayExpression':
			var elements = p.elements.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				elements: elements
			})

		case 'ContinueStatement':
		case 'BreakStatement':
			return fo({
				type: p.type,
				label: p.label
			})

		case 'CatchClause':
			var param = mapJS(f, p.param, fo);
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				param: param,
				body: body
			})

		case 'ForStatement':
			var init = mapJS(f, p.init, fo);
			var test = mapJS(f, p.test, fo);
			var update = mapJS(f, p.update, fo);
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				init: init,
				test: test,
				update: update,
				body: body
			})

		case 'ForInStatement':
			var left = mapJS(f, p.left, fo);
			var right = mapJS(f, p.right, fo);
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				left: left,
				right: right,
				body: body,
				each: p.each
			})

		case 'LabeledStatement':
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				label: p.label,
				body: body
			})

		case 'Property':
			var key = mapJS(f, p.key, fo);
			var value = mapJS(f, p.value, fo);
			return fo({
				type: p.type,
				key: key,
				computed: p.computed,
				value: value,
				kind: p.kind,
				method: p.method,
				shorthand: p.shorthand
			})

		case 'SequenceExpression':
			var expressions = p.expressions.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				expressions: expressions
			})

		case 'SwitchStatement':
			var discriminant = mapJS(f, p.discriminant, fo);
			var cases = p.cases.map((s) => mapJS(f, s, fo));
			return fo({
				type: p.type,
				discriminant: discriminant,
				cases: cases
			})

		case 'SwitchCase':
			var test = mapJS(f, p.test, fo);
			var consequent = mapJS(f, p.consequent, fo);
			return fo({
				type: p.type,
				test: test,
				consequent: consequent
			})

		case 'TryStatement':
			var block = mapJS(f, p.block, fo);
			var handler = mapJS(f, p.handler, fo);
			var finalizer = mapJS(f, p.finalizer, fo);
			return fo({
				type: p.type,
				block: block,
				handler: handler,
				finalizer: finalizer
			})

		case 'VariableDeclarator':
			var id = mapJS(f, p.id, fo);
			var init = mapJS(f, p.init, fo);
			return fo({
				type: p.type,
				id: id,
				init: init
			})

		case 'WithStatement':
			var object = mapJS(f, p.object, fo);
			var body = mapJS(f, p.body, fo);
			return fo({
				type: p.type,
				object: object,
				body: body
			})

		default: return p
	}
}

module.exports = mapJS;