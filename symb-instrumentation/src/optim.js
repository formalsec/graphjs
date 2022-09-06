/**
 * File that implements optimizations for the symbolic tests
 */

/**
 * Requires
 */

const js2ast = require('../utils/js_ast_generation/ast_utils').js2ast;
const mapJS = require('../utils/js_ast_manipulation/js_mapper');


/**
 * Function that detects if a given ast object is used in the execution path
 * from the source to the sink
 * @param {Object} ast 
 * Esprima AST object
 * @param {int []} lines
 * Lines that are executed in the computation path from source to sink
 * @returns {bool} 
 * True if the object is used, false otherwise 
 */
function executed(ast, lines) {
	let range = Array.from(Array(ast.loc.enf.line - ast.loc.start.line + 1), (x, i) => i + ast.loc.start.line);
	return !range.every((e) => !lines.includes(e));
}

/**
 * Reducing function to remove unused lines and replace them with Assume(false)
 * @param {[(arr) Object [], (state) bool]} acc
 * Accumulator of the reducer, contains the filtered array so far and the state
 * which tells if the previous element has been filtered
 * @param {Object} e
 * Esprima AST object
 */
function block_unused_computation_paths(lines, acc, e) {
	if(acc[1] === true) {
		return acc;
	}
	if(executed(e)) {
		acc[0].push(e);
	} else {
		acc[0].push(js2ast('Assume(false);'));
		acc[1] = true;
	}
	return acc;
}

function optimize(ast, lines) {
	/**
	 * Remove unused computation paths (remove unused lines and add Assume
	 * (false))
	 */
	function fo(lines, ast) {
		switch(ast.type) {
			case 'Program':
				ast.body = ast.body.reduce(block_unused_computation_paths(lines), [[], false])[0];
				return ast;
			case 'BlockStatement':
				ast.body = ast.body.reduce(block_unused_computation_paths(lines), [[], false])[0];
				return ast;
			case 'ConditionalExpression':
			case 'IfStatement':
				if(!executed(ast.consequent)) {
					ast.consequent = js2ast('Assume(false);');
				} else if(!executed(ast.alternate)) {
					ast.alternate = js2ast('Assume(false);');
				}
				return ast;
			case 'SwitchStatement':
				ast.cases.reduce(block_unused_computation_paths(lines), [[], false])[0];
				return ast;
			case 'TryStatement':
				if(!executed(ast.handler)) {
					ast.handler = js2ast('Assume(false);');
				}
				if(!executed(ast.finalizer)) {
					ast.finalizer = js2ast('Assume(false);');
				}
				return ast;
			default:
				return ast;
		}
	}
	return mapJS((e) => null, ast, fo(lines));
}

module.exports = optimize;