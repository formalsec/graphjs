const instr_const = require("../constants/instr_constants");

/**
 * Symbolic variable name generators:
 * These functions return a variable name generator for each variable type the 
 * instrumenter generates.
 */
let fresh_symb_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_prefix + count++;
	}
}

let fresh_symb_obj_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_obj_prefix + count++;
	}
}

let fresh_symb_prop_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_prop_prefix + count++;
	}
}

let fresh_symb_num_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_num_prefix + count++;
	}
}

let fresh_symb_str_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_str_prefix + count++;
	}
}

let fresh_symb_bool_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_bool_prefix + count++;
	}
}

let fresh_symb_func_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_bool_prefix + count++;
	}
}

let fresh_concrete_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.concrete_prefix + count++;
	}
}

let fresh_obj_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.obj_prefix + count++;
	}
}

let fresh_array_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.array_prefix + count ++;
	}
}

let fresh_obj_prop_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.obj_prop_prefix + count ++;
	}
}

/**
 * Symbolic test name generator
 */
let fresh_test_var_gen = function() {
	var count = 0;
	return function() {
		return instr_const.symb_test + count++;
	}
}

module.exports = { fresh_symb_var_gen, fresh_symb_num_var_gen, fresh_symb_str_var_gen, fresh_symb_bool_var_gen, fresh_concrete_var_gen, fresh_obj_var_gen, fresh_obj_prop_var_gen, fresh_array_var_gen, fresh_symb_obj_var_gen, fresh_symb_prop_var_gen, fresh_test_var_gen, fresh_symb_func_var_gen };