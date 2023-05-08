/**
 * AST generation and parsing tools
 */

/**
 * Require
 */
const esprima = require("esprima-next");
const generate = require("escodegen").generate;

/**
 * This function takes an Esprima AST object and returns a string with the 
 * parsed program
 * @param {Object} obj
 * Esprima AST Object 
 * @returns {String}
 * Corresponding JavaScript source file
 */
function ast2js(obj) {
	try {
		const option = {
			format: {
				quotes: 'single',
				indent: {
					style: '\t'
				}
			}
		};
		return generate(obj, option);
	} catch (err) {
		if ((typeof obj) === "object") {
			console.log("converting the following ast to str:\n" + e);
		} else {
			console.log("e is not an object!!!")
		}
		throw "ast2str failed.";
	}
}

/**
 * This function takes a JavaScript program as a string and returns the
 * corresponding Esprima AST Object
 * @param {String} str
 * JavaScript file
 * @returns {Object}
 * Corresponding Esprima AST object
 */
function js2ast(str) {
	return esprima.parseScript(str, {loc:true});
}



module.exports = { ast2js, js2ast }