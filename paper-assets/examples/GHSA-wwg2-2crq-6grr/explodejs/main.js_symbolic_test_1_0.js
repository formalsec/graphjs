var obj___instr_obj_23 = {};
var obj____any_property___instr_obj_22 = {};
var obj____any_property____any_property___instr_symb_obj_6 = esl_symbolic.object("obj____any_property____any_property___instr_symb_obj_6");
instr_any_prop_12 = esl_symbolic.string("instr_any_prop_12")
obj____any_property___instr_obj_22[instr_any_prop_12] = obj____any_property____any_property___instr_symb_obj_6;
instr_any_prop_13 = esl_symbolic.string("instr_any_prop_13")
obj___instr_obj_23[instr_any_prop_13] = obj____any_property___instr_obj_22;
var path___instr_obj_24 = {};
var path____length___instr_symb_num_16 = esl_symbolic.number("path____length___instr_symb_num_16");
path___instr_obj_24.length = path____length___instr_symb_num_16;
var val___instr_symb_bool_6 = esl_symbolic.function("val___instr_symb_bool_6");
var sep___instr_symb_num_17 = esl_symbolic.number("sep___instr_symb_num_17");

'use strict';
const isObject = val => {
	const v1 = typeof val;
	const v2 = v1 === 'object';
	const v3 = typeof val;
	const v4 = v3 === 'function';
	const v5 = v2 || v4;
	return v5;
};
const set = (obj, parts, length, val) => {
	let tmp = obj;
	let i = 0;
	const v6 = length - 1;
	let v7 = i < v6;
	while (v7) {
		const part = parts[i];
		const v9 = tmp[part];
		const v10 = isObject(v9);
		const v11 = !v10;
		const v12 = tmp[part];
		if (v11) {
			tmp = tmp[part] = {};
		} else {
			tmp = v12;
		}
		const v8 = i++;
		v7 = i < v6;
	}
	const v13 = parts[i];
	tmp[v13] = val;
	return obj;
};
const v28 = (obj, path, val, sep = '.') => {
	const v14 = isObject(obj);
	const v15 = !v14;
	const v16 = !path;
	const v17 = v15 || v16;
	const v18 = path.length;
	const v19 = !v18;
	const v20 = v17 || v19;
	if (v20) {
		return obj;
	}
	let parts;
	const v21 = Array.isArray(path);
	const v22 = String(path);
	const v23 = v22.split(sep);
	if (v21) {
		parts = path;
	} else {
		parts = v23;
	}
	const v24 = parts;
	const length = v24.length;
	const v25 = length === 1;
	if (v25) {
		const v26 = parts[0];
		obj[v26] = val;
		return obj;
	}
	const v27 = set(obj, parts, length, val);
	return v27;
};

v28(obj___instr_obj_23, path___instr_obj_24, val___instr_symb_bool_6, sep___instr_symb_num_17);
