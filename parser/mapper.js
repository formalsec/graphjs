module.exports = mapper;

function mapper(callback, obj) {
  if (!obj) return obj;

  var ret = callback(obj);
  var new_obj = ret.obj;
  if (!ret.recurse) return new_obj;

  switch (new_obj.type) {
    //
    // Scripts
    //
    case "Program":
      return {
        type: "Program",
        sourceType: "script",
        body: new_obj.body.map((stmt) => mapper(callback, stmt)),
      };

    //
    // Expressions
    //
    case "Identifier":
      return {
        type: "Identifier",
        name: new_obj.name,
      };

    case "Literal":
      return new_obj.hasOwnProperty("regex")
        ? {
            type: "Literal",
            value: new_obj.value,
            raw: new_obj.raw,
            regex: new_obj.regex,
          }
        : {
            type: "Literal",
            value: new_obj.value,
            raw: new_obj.raw,
          };

    case "ArrayExpression":
      return {
        type: "ArrayExpression",
        elements: new_obj.elements.map((obj) => mapper(callback, obj)),
      };

    case "ObjectExpression":
      return {
        type: "ObjectExpression",
        properties: new_obj.properties.map((obj) => mapper(callback, obj)),
      };

    case "Property":
      return {
        type: "Property",
        key: mapper(callback, new_obj.key),
        value: mapper(callback, new_obj.value),
        computed: new_obj.computed,
        kind: new_obj.kind,
        shorthand: new_obj.shorthand,
      };

    case "FunctionExpression":
      return {
        type: "FunctionExpression",
        id: mapper(callback, new_obj.id),
        params: new_obj.params.map((param) => mapper(callback, param)),
        body: mapper(callback, new_obj.body),
        generator: new_obj.generator,
        async: new_obj.async,
        expression: new_obj.expression,
      };

    case "MemberExpression":
      return {
        type: "MemberExpression",
        computed: new_obj.computed,
        object: mapper(callback, new_obj.object),
        property: mapper(callback, new_obj.property),
      };

    case "CallExpression":
      return {
        type: "CallExpression",
        callee: mapper(callback, new_obj.callee),
        arguments: new_obj.arguments.map((arg) => mapper(callback, arg)),
      };

    case "NewExpression":
      return {
        type: "NewExpression",
        callee: mapper(callback, new_obj.callee),
        arguments: new_obj.arguments.map((arg) => mapper(callback, arg)),
      };

    case "UpdateExpression":
      return {
        type: "UpdateExpression",
        operator: new_obj.operator,
        argument: mapper(callback, new_obj.argument),
        prefix: new_obj.prefix,
      };

    case "UnaryExpression":
      return {
        type: "UnaryExpression",
        operator: new_obj.operator,
        argument: mapper(callback, new_obj.argument),
        prefix: new_obj.prefix,
      };

    case "BinaryExpression":
      return {
        type: "BinaryExpression",
        operator: new_obj.operator,
        left: mapper(callback, new_obj.left),
        right: mapper(callback, new_obj.right),
      };

    case "LogicalExpression":
      return {
        type: "LogicalExpression",
        operator: new_obj.operator,
        left: mapper(callback, new_obj.left),
        right: mapper(callback, new_obj.right),
      };

    case "ConditionalExpression":
      return {
        type: "ConditionalExpression",
        test: mapper(callback, new_obj.test),
        consequent: mapper(callback, new_obj.consequent),
        alternate: mapper(callback, new_obj.alternate),
      };

    case "AssignmentExpression":
      return {
        type: "AssignmentExpression",
        operator: new_obj.operator,
        left: mapper(callback, new_obj.left),
        right: mapper(callback, new_obj.right),
      };

    case "SequenceExpression":
      return {
        type: "SequenceExpression",
        expressions: new_obj.expressions.map((expr) => mapper(callback, expr)),
      };

    //
    // Statements and Declarations
    //
    case "BlockStatement":
      return {
        type: "BlockStatement",
        body: new_obj.body.map((stmt) => mapper(callback, stmt)),
      };

    case "BreakStatement":
      return {
        type: "BreakStatement",
        label: mapper(callback, new_obj.label),
      };

    case "ContinueStatement":
      return {
        type: "ContinueStatement",
        label: mapper(callback, new_obj.label),
      };

    case "DoWhileStatement":
      return {
        type: "DoWhileStatement",
        body: mapper(callback, new_obj.body),
        test: mapper(callback, new_obj.test),
      };

    case "ExpressionStatement":
      return new_obj.hasOwnProperty("directive")
        ? {
            type: "ExpressionStatement",
            expression: mapper(callback, new_obj.expression),
            directive: new_obj.directive,
          }
        : {
            type: "ExpressionStatement",
            expression: mapper(callback, new_obj.expression),
          };

    case "ForStatement":
      return {
        type: "ForStatement",
        init: mapper(callback, new_obj.init),
        test: mapper(callback, new_obj.test),
        update: mapper(callback, new_obj.update),
        body: mapper(callback, new_obj.body),
      };

    case "ForInStatement":
      return {
        type: "ForInStatement",
        left: mapper(callback, new_obj.left),
        right: mapper(callback, new_obj.right),
        body: mapper(callback, new_obj.body),
        each: new_obj.each,
      };

    case "FunctionDeclaration":
      return {
        type: "FunctionDeclaration",
        id: mapper(callback, new_obj.id),
        params: new_obj.params.map((param) => mapper(callback, param)),
        body: mapper(callback, new_obj.body),
        generator: new_obj.generator,
        async: new_obj.async,
        expression: new_obj.expression,
      };

    case "IfStatement":
      return new_obj.hasOwnProperty("alternate")
        ? {
            type: "IfStatement",
            test: mapper(callback, new_obj.test),
            consequent: mapper(callback, new_obj.consequent),
            alternate: mapper(callback, new_obj.alternate),
          }
        : {
            type: "IfStatement",
            test: mapper(callback, new_obj.test),
            consequent: mapper(callback, new_obj.consequent),
          };

    case "LabeledStatement":
      return {
        type: "LabeledStatement",
        label: mapper(callback, new_obj.label),
        body: mapper(callback, new_obj.body),
      };

    case "ReturnStatement":
      return {
        type: "ReturnStatement",
        argument: mapper(callback, new_obj.argument),
      };

    case "SwitchStatement":
      return {
        type: "SwitchStatement",
        discriminant: mapper(callback, new_obj.discriminant),
        cases: new_obj.cases.map((kase) => mapper(callback, kase)),
      };

    case "SwitchCase":
      return {
        type: "SwitchCase",
        test: mapper(callback, new_obj.test),
        consequent: new_obj.consequent.map((stmt) => mapper(callback, stmt)),
      };

    case "ThrowStatement":
      return {
        type: "ThrowStatement",
        argument: mapper(callback, new_obj.argument),
      };

    case "VariableDeclaration":
      return {
        type: "VariableDeclaration",
        declarations: new_obj.declarations.map((declr) =>
          mapper(callback, declr)
        ),
        kind: new_obj.kind,
      };

    case "VariableDeclarator":
      return {
        type: "VariableDeclarator",
        id: mapper(callback, new_obj.id),
        init: mapper(callback, new_obj.init),
      };

    case "WhileStatement":
      return {
        type: "WhileStatement",
        test: mapper(callback, new_obj.test),
        body: mapper(callback, new_obj.body),
      };

    case "WithStatement":
      return {
        type: "WithStatement",
        object: mapper(callback, new_obj.object),
        body: mapper(callback, new_obj.body),
      };

    case "TryStatement":
      return {
        type: "TryStatement",
        block: mapper(callback, new_obj.block),
        handler: mapper(callback, new_obj.handler),
        finalizer: mapper(callback, new_obj.finalizer),
      };

    case "CatchClause":
      return {
        type: "CatchClause",
        param: mapper(callback, new_obj.param),
        body: mapper(callback, new_obj.body),
      };

    default:
      return new_obj;
  }
}
