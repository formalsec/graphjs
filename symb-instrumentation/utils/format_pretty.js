const mapJS = require("./js_ast_manipulation/js_mapper");

/**
 * 
 * @param {Object} ast
 * Esprima AST Object
 * @returns
 * Esprima AST Object with folded nested BlockStatements and without the empty 
 * statement resulting from removing module.exports
 */
function format_pretty(ast) {

	function callback_f(ast) {
		return null
	}

	function callback_fo(ast) {
		switch (ast.type) {
			case "BlockStatement":
				var stmts = [];
				for (var i = 0; i < ast.body.length; i++) {
					var stmt = ast.body[i];
					if (stmt.type === "BlockStatement") {
						stmts = stmts.concat(stmt.body);
					} else if (stmt.type !== "EmptyStatment") {
						stmts.push(stmt)
					}
				}
				ast.body = stmts.filter((x) => x.type != "EmptyStatement");
				return ast;
			case "Program":
				/* Filter empty statement resulting of module.exports */
				ast.body = ast.body.filter((x) => x.type != "EmptyStatement")
				return ast;
			default: 
				return ast;
		}
	}

	return mapJS(callback_f, ast, callback_fo);
}

module.exports = format_pretty;