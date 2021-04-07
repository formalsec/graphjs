module.exports = traverse;

/**
 * Function that traverses an Esprima AST.
 * For every object found it calls the provided **callback** function and checks its return value
 * to determine if the traversing continues to the descending objects.
 *
 * @param {Function} callback
 * Function called passing the param **obj**.
 * Should return an object with two properties: **data**, an array with the result of the
 * desired computation of the provided **obj**, and **stop**, a boolean value that controls
 * the continuation of the object tree traversing.
 * @param {Object} obj
 * An Esprima AST object representing an Expression, a Statement or a Script.
 *
 * @returns an object containing one property of type Array: **data**. This value represents the
 * total values computed by the **callback** function.
 */
function traverse(callback, obj) {
  function mapReduce(arr) {
    return arr
      .map((item) => traverse(callback, item));
      // .reduce((acc, retObj) => acc.concat(retObj), []);
  }

  if (obj === null) {
    return null;
  }

  let resultData = [];
  switch (obj.type) {
    //
    // Scripts
    //
    case "Program":
      resultData = mapReduce(obj.body);
      break;

    //
    // Expressions
    //
    case "ArrayExpression":
      resultData = mapReduce(obj.elements);
      break;

    case "ObjectExpression":
      resultData = mapReduce(obj.properties);
      break;
    case "Property": {
      const resultKey = traverse(callback, obj.key);
      const resultValue = traverse(callback, obj.value);

      resultData = [
        resultKey,
        resultValue
      ];
      break;
    }

    case "MemberExpression": {
      const resultObject = traverse(callback, obj.object);
      const resultProperty = traverse(callback, obj.property);

      resultData = [
        resultObject,
        resultProperty
      ];
      break;
    }

    case "CallExpression":
    case "NewExpression": {
      const resultCallee = traverse(callback, obj.callee);
      const resultArguments = mapReduce(obj.arguments);

      resultArguments.unshift(resultCallee);
      resultData = resultArguments;
      break;
    }

    case "UpdateExpression":
    case "UnaryExpression":
      resultData = [ traverse(callback, obj.argument) ];
      break;

    case "BinaryExpression":
    case "LogicalExpression":
    case "AssignmentExpression": {
      const resultLeft = traverse(callback, obj.left);
      const resultRight = traverse(callback, obj.right);

      resultData = [
        resultLeft,
        resultRight
      ];
      break;
    }

    case "SequenceExpression":
      resultData = mapReduce(obj.expressions);
      break;

    //
    // Statements and Declarations
    //
    case "BlockStatement":
      resultData = mapReduce(obj.body);
      break;

    case "DoWhileStatement":
    case "WhileStatement": {
      const resultTest = traverse(callback, obj.test);
      const resultBody = traverse(callback, obj.body);

      resultData = [
        resultTest,
        resultBody
      ];
      break;
    }

    case "ExpressionStatement":
      resultData = [ traverse(callback, obj.expression) ];
      break;

    case "ForStatement": {
      const resultInit = traverse(callback, obj.init);
      const resultTest = traverse(callback, obj.test);
      const resultUpdate = traverse(callback, obj.update);
      const resultBody = traverse(callback, obj.body);

      resultData = [
        resultInit,
        resultTest,
        resultUpdate,
        resultBody
      ];
      break;
    }

    case "ForInStatement": {
      const resultLeft = traverse(callback, obj.left);
      const resultRight = traverse(callback, obj.right);
      const resultBody = traverse(callback, obj.body);

      resultData = [
        resultLeft,
        resultRight,
        resultBody
      ];
      break;
    }

    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "LabeledStatement":
      resultData = [ traverse(callback, obj.body) ];
      break;

    case "IfStatement":
    case "ConditionalExpression": {
      const resultTest = traverse(callback, obj.test);
      const resultConsequent = traverse(callback, obj.consequent);
      const resultAlternate = traverse(callback, obj.alternate);

      resultData = [
        resultTest,
        resultConsequent,
        resultAlternate
      ];
      break;
    }

    case "ReturnStatement":
    case "ThrowStatement":
      resultData = [ traverse(callback, obj.argument) ];
      break;

    case "SwitchStatement": {
      const resultDiscriminant = traverse(callback, obj.discriminant);
      const resultCases = mapReduce(obj.cases);

      resultCases.unshift(resultDiscriminant);
      resultData = resultCases;
      break;
    }
    case "SwitchCase": {
      const resultTest = traverse(callback, obj.test);
      const resultConsequent = mapReduce(obj.consequent);

      resultConsequent.unshift(resultTest);
      resultData = resultConsequent;
      break;
    }

    case "VariableDeclaration":
      resultData = mapReduce(obj.declarations);
      break;
    case "VariableDeclarator": {
      const resultId = traverse(callback, obj.id);
      const resultInit = traverse(callback, obj.init);

      resultData = [ resultId, resultInit ];
      break;
    }

    case "WithStatement": {
      const resultObject = traverse(callback, obj.object);
      const resultBody = traverse(callback, obj.body);

      resultData = [ resultObject, resultBody ];
      break;
    }

    case "TryStatement": {
      const resultBlock = traverse(callback, obj.block);
      const resultHandler = traverse(callback, obj.handler);
      const resultFinalizer = traverse(callback, obj.finalizer);

      resultData = [
        resultBlock,
        resultHandler,
        resultFinalizer
      ];
      break;
    }

    case "CatchClause": {
      const resultParam = traverse(callback, obj.param);
      const resultBlock = traverse(callback, obj.body);

      resultData = [ resultParam, resultBlock ];
      break;
    }

    default:
      resultData = [];
      break;
  }

  // TODO:
  // Combinar os resultados dos sub-objectos em graphs
  const cbResult = callback(obj, resultData);

  return cbResult;
}
