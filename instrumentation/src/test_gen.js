/**
 * Library to generate a specific symbolic test from a test template and a 
 * config file
 */

/**
 * Require
 */
const var_gen = require("../utils/variable_name_gen");
const { js2ast, ast2js } = require("../utils/js_ast_generation/ast_utils");
const map_reduceJS = require("../utils/js_ast_manipulation/js_map_reduce");
const mapJS = require("../utils/js_ast_manipulation/js_mapper");
const format_pretty = require("../utils/format_pretty");
const instr_const = require("../constants/instr_constants");

/**
 * Auxiliary functions
 */

/**
 * This function receives a program and a list of sink types and returns the 
 * list of variables which have been used in the normalization instead of the 
 * ones that are member expressions 
 * @param {Object} ast 
 * Esprima AST representation of a JavaScript program
 * @param {String[]} sink_types
 * Array of types of sinks
 * @returns
 * 
 */
function get_additional_sinks(ast, sinks) {
	function f(p) {
		try {
			switch (p.type) {
				case "VariableDeclarator":
					// var <var> = <obj>
					if(p.init.type === "Identifier" && sinks === ast2js(p.init)) {
						return [p.id.name];
					} 
					// car <var> = <obj>.<prop>
					else if (p.init.type === "MemberExpression" && sinks === ast2js(p.init)){
						return [p.id.name];
					}
					else {
						return [];
					}
				default:
					return [];
			}
		} catch (e) {
			console.log("get_mem_exp_sink_vars: parameter is not an AST.");
		}
	}
	return map_reduceJS(f, (d, ac) => d.concat(ac), ast, []);
}

let fresh_symb_var = var_gen.fresh_symb_var_gen();
let fresh_obj_var = var_gen.fresh_obj_var_gen();
let fresh_obj_prop_var = var_gen.fresh_obj_prop_var_gen();
let fresh_array_var = var_gen.fresh_array_var_gen();
let fresh_symb_num_var = var_gen.fresh_symb_num_var_gen();
let fresh_symb_str_var = var_gen.fresh_symb_str_var_gen();
let fresh_symb_bool_var = var_gen.fresh_symb_bool_var_gen();
let fresh_concrete_var = var_gen.fresh_concrete_var_gen();
let fresh_test_var = var_gen.fresh_test_var_gen();

/**
 * Main functions
 */
/**

/**
 * Instrument vulnerable function code
 * @param {Object} ast
 * Esprima AST representation of JavaScript code
 * @param {Object} stmt
 * Esprima AST statement
 */
function instrument_code(ast, stmt) {
	var arg_check = "";
	stmt.forEach((argument) => {
		let test_var = fresh_test_var();
		arg_check += "const " + test_var + " = !is_symbolic(" + ast2js(argument) + ");\n" + "Assert(" + test_var + ");\n";
	})
	return js2ast("{\n" + arg_check + ast2js(ast) + "};");
}

/**
 * Remove module.exports and add a test before each vulnerable sink to see if 
 * input is safe (i.e. not symbolic)
 * @param {Object} ast_prog
 * Esprima AST representation of JavaScript code
 * @param {Object} sink 
 * Unsafe sink name
 */
 function module_exp_rm_sink_safeguard(ast_prog, sink, sink_lineno) {
	function f(ast) {
		switch (ast.type) {
			case "VariableDeclaration":
				/* let <var> = <sink>(<var>) */
				if (ast.declarations[0].init && (ast.declarations[0].init.type === "CallExpression" || ast.declarations[0].init.type === "NewExpression") 
				&& ast.loc.start.line === sink_lineno) {
					ast.declarations[0].init.callee.name = `esl_symbolic.${ast.declarations[0].init.callee.name}Wrapper`
				}
				return null;
			case "ExpressionStatement":
				/* Remove module.exports = {} */
				if (ast.expression.type === "AssignmentExpression" && ast2js(ast.expression.left) === "module.exports") {
					return { type: "EmptyStatement" };
				} else if (ast.expression.type === "AssignmentExpression" && ast.expression.right.type === "CallExpression" 
				&& ast.loc.start.line === sink_lineno) {
					/* let <var> = <package>.<sink>(<var>) */
					ast.expression.right.callee.object.name = "esl_symbolic"
					ast.expression.right.callee.property.name = `${ast.expression.right.callee.property.name}Wrapper`
				}
				return null;
			default: 
				return null;
		}
	};
	return mapJS(f, ast_prog);
}

/**
 * Receives a function parameter object and returns the string corresponding to 
 * the declaration of that parameter as a symbolic variable of the specified 
 * type (in case of concrete, declares to the value)
 * @param {String} param_name 
 * Parameter name
 * @param {Object} param_type 
 * Parameter type, i.e, object structure and types
 * @param {Object} var_info
 * Information about a variable
 * @returns {string}
 * Variable assignment
 */
function generate_symb_assignment(param_name, param_type, prefix = "", isObjOrArr=false) {
	param_name = param_name === "*" ? "any_property" : param_name;
	var name = prefix + `${param_name}__`;

	if (typeof param_type === 'object' && !Array.isArray(param_type) && param_type !== null) {
		var properties_assignment = Object.entries(param_type).map(([param, param_type]) => generate_symb_assignment(param, param_type, `${name}__`));
		name += `_${fresh_obj_var()}`;
		var tmplt = `var ${name} = {};\n`;
		var sub_properties_arr = Object.keys(param_type)
		tmplt = tmplt.concat(
			/* Templates of properties */
			properties_assignment.map((p) => p.tmplt).join(''),
			/* Assignments of properties to created vars */
			properties_assignment.map((p, index) => `${name}.${sub_properties_arr[index] != "*" ? sub_properties_arr[index] : fresh_obj_prop_var()} = ${p.name};\n`).join('')); 
		return {name: name, tmplt: tmplt};
	} else if (Array.isArray(param_type)) {
			name += `_${fresh_array_var()}`;
			var tmplt = `var ${name} = []\n`;
			param_type = param_type.length ? param_type : Array(instr_const.symb_array_length).fill("any")
			for (i = 0; i < param_type.length; i++) {
				element = generate_symb_assignment(i, param_type[i], `${name}__`);
				tmplt = tmplt.concat(element.tmplt, `${name}.push(${element.name});\n`);
			}
			return {name: name, tmplt: tmplt}
	} else {
		switch (param_type) {
			case "any":
				name += `_${fresh_symb_var()}`;
				if (isObjOrArr) return `\tesl_symbolic.symb("${name}"),\n`;
				var tmplt = `var ${name} = esl_symbolic.symb("${name}");\n`;
				return {name: name, tmplt: tmplt};

			case "number":
				name += `_${fresh_symb_num_var()}`;
				var tmplt = `var ${name} = esl_symbolic.number("${name}");\n`;
				return {name: name, tmplt: tmplt};

			case "string":
				name += `_${fresh_symb_str_var()}`;
				if (isObjOrArr) return `\tesl_symbolic.string("${name}"),\n`;
				var tmplt = `var ${name} = esl_symbolic.string("${name}");\n`;
				return {name:name, tmplt: tmplt};

			// case "prop_string":
			// 	name += `_${fresh_symb_str_var()}`;
			// 	if (isObjOrArr) return `\tesl_symbolic.prop_string("${name}"),\n`;
			// 	var tmplt = `var ${name} = esl_symbolic.prop_string("${name}");\n` +
			// 					`Assume(not(${name} = "valueOf"));\n` +
			// 					`Assume(not(${name} = "toString"));\n` +
			// 					`Assume(not(${name} = "hasOwnProperty"));\n` +
			// 					`Assume(not(${name} = "constructor"));\n`;
			// 	return {name: name, tmplt: tmplt};

			case "bool":
				name += `_${fresh_symb_bool_var()}`;
				if (isObjOrArr) return `\tesl_symbolic.bool("${name}"),\n`;
				var tmplt = `var ${name} = esl_symbolic.bool("${name}");\n`;
				return {name: name, tmplt: tmplt};

			case "concrete":
				name += `_${fresh_concrete_var()}`;
				var tmplt;
				if (var_info.value) {
					tmplt = `var ${name} = ${var_info.value};\n`;
				} else {
					tmplt = `var ${name};\n`
				}
				return {name: name, tmplt: tmplt };

			default: 
				throw new Error("Unsupported: generate_symb_assignment")
		}
	}
}

/**
 * Generates a symbolic test from a normalized source file and a config. Removes
 * the module.exports, adds a safeguard for each sink, declares the used
 * variables and calls the function with the variables
 * @param {Object} config 
 * @param {Object} prog
 * Esprima AST program
 * @returns
 * A symbolic test in JavaScript string format
 */
function generate_test(prog, config) {
	/* Remove module.exports and check if sink type is symbolic */
	 var parsed_prog = format_pretty(js2ast(ast2js(module_exp_rm_sink_safeguard(prog, config.sink, config.sink_lineno))));
	/* Add definitions and assignments of the variables needed for the program */
	var assignments = Object.entries(config.params_types).map(([param, param_type]) => generate_symb_assignment(param, param_type, ""));
	/* Get function parameter names */
	var param_names = assignments.map(e => e.name);
	/* Get assignment strings of symbolic variables and objects */
	var assignment_templates = assignments.map(e => e.tmplt).join('');
	/* Parse the function call with the parameter names */
	var func_call = `${config.source}(${param_names.join(", ")});\n`
	/** Assignments + Program + Function Call */
	return assignment_templates + '\n' + ast2js(parsed_prog) + '\n\n' + func_call;
}

module.exports = generate_test;