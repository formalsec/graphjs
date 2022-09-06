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

 function traverseJS(callback, obj) {
    function mapReduce(arr) {
      return arr
        .map((item) => traverseJS(callback, item))
        .reduce((acc, retObj) => acc.concat(retObj.data), []);
    }
  
    if (obj === null) {
      return {
        data: [],
      };
    }
  
    const cbResult = callback(obj);
  
    if (cbResult.stop) {
      return {
        data: cbResult.data,
      };
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
        const resultKey = traverseJS(callback, obj.key);
        const resultValue = traverseJS(callback, obj.value);
  
        resultData = resultKey.data.concat(resultValue.data);
        break;
      }
  
      case "MemberExpression": {
        const resultObject = traverseJS(callback, obj.object);
        const resultProperty = traverseJS(callback, obj.property);
  
        resultData = resultObject.data.concat(resultProperty.data);
        break;
      }
  
      case "CallExpression":
      case "NewExpression": {
        const resultCallee = traverseJS(callback, obj.callee);
        const resultArguments = mapReduce(obj.arguments);
  
        resultData = resultCallee.data.concat(resultArguments);
        break;
      }
  
      case "UpdateExpression":
      case "UnaryExpression":
        resultData = traverseJS(callback, obj.argument).data;
        break;
  
      case "BinaryExpression":
      case "LogicalExpression":
      case "AssignmentExpression": {
        const resultLeft = traverseJS(callback, obj.left);
        const resultRight = traverseJS(callback, obj.right);
  
        resultData = resultLeft.data.concat(resultRight.data);
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
        const resultTest = traverseJS(callback, obj.test);
        const resultBody = traverseJS(callback, obj.body);
  
        resultData = resultTest.data.concat(resultBody.data);
        break;
      }
  
      case "ExpressionStatement":
        resultData = traverseJS(callback, obj.expression).data;
        break;
  
      case "ForStatement": {
        const resultInit = traverseJS(callback, obj.init);
        const resultTest = traverseJS(callback, obj.test);
        const resultUpdate = traverseJS(callback, obj.update);
        const resultBody = traverseJS(callback, obj.body);
  
        resultData = resultInit.data.concat(
          resultTest.data,
          resultUpdate.data,
          resultBody.data
        );
        break;
      }
  
      case "ForInStatement": {
        const resultLeft = traverseJS(callback, obj.left);
        const resultRight = traverseJS(callback, obj.right);
        const resultBody = traverseJS(callback, obj.body);
  
        resultData = resultLeft.data.concat(resultRight.data, resultBody.data);
        break;
      }
  
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "LabeledStatement":
        resultData = traverseJS(callback, obj.body).data;
        break;
  
      case "IfStatement":
      case "ConditionalExpression": {
        const resultTest = traverseJS(callback, obj.test);
        const resultConsequent = traverseJS(callback, obj.consequent);
        const resultAlternate = traverseJS(callback, obj.alternate);
  
        resultData = resultTest.data.concat(
          resultConsequent.data,
          resultAlternate.data
        );
        break;
      }
  
      case "ReturnStatement":
      case "ThrowStatement":
        resultData = traverseJS(callback, obj.argument).data;
        break;
  
      case "SwitchStatement": {
        const resultDiscriminant = traverseJS(callback, obj.discriminant);
        const resultCases = mapReduce(obj.cases);
  
        resultData = resultDiscriminant.data.concat(resultCases);
        break;
      }
      case "SwitchCase": {
        const resultTest = traverseJS(callback, obj.test);
        const resultConsequent = mapReduce(obj.consequent);
  
        resultData = resultTest.data.concat(resultConsequent);
        break;
      }
  
      case "VariableDeclaration":
        resultData = mapReduce(obj.declarations);
        break;
      case "VariableDeclarator": {
        const resultId = traverseJS(callback, obj.id);
        const resultInit = traverseJS(callback, obj.init);
  
        resultData = resultId.data.concat(resultInit.data);
        break;
      }
  
      case "WithStatement": {
        const resultObject = traverseJS(callback, obj.object);
        const resultBody = traverseJS(callback, obj.body);
  
        resultData = resultObject.data.concat(resultBody.data);
        break;
      }
  
      case "TryStatement": {
        const resultBlock = traverseJS(callback, obj.block);
        const resultHandler = traverseJS(callback, obj.handler);
        const resultFinalizer = traverseJS(callback, obj.finalizer);
  
        resultData = resultBlock.data.concat(
          resultHandler.data,
          resultFinalizer.data
        );
        break;
      }
  
      case "CatchClause": {
        const resultParam = traverseJS(callback, obj.param);
        const resultBlock = traverseJS(callback, obj.body);
  
        resultData = resultParam.data.concat(resultBlock.data);
        break;
      }
  
      default:
        resultData = [];
        break;
    }
  
    return {
      data: cbResult.data.concat(resultData),
    };
  }

  module.exports = traverseJSJS;