var obj___instr_array_12 = []
var obj___instr_array_12__0___instr_symb_str_42 = esl_symbolic.string("obj___instr_array_12__0___instr_symb_str_42");
obj___instr_array_12.push(obj___instr_array_12__0___instr_symb_str_42);
var obj___instr_array_12__1___instr_symb_str_43 = esl_symbolic.string("obj___instr_array_12__1___instr_symb_str_43");
obj___instr_array_12.push(obj___instr_array_12__1___instr_symb_str_43);
var obj___instr_array_12__2___instr_symb_str_44 = esl_symbolic.string("obj___instr_array_12__2___instr_symb_str_44");
obj___instr_array_12.push(obj___instr_array_12__2___instr_symb_str_44);
var path___instr_obj_39 = {};
var path____length___instr_symb_num_24 = esl_symbolic.number("path____length___instr_symb_num_24");
path___instr_obj_39.length = path____length___instr_symb_num_24;
var val___instr_symb_bool_9 = esl_symbolic.function("val___instr_symb_bool_9");
var sep___instr_symb_num_25 = esl_symbolic.number("sep___instr_symb_num_25");

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

v28(obj___instr_array_12, path___instr_obj_39, val___instr_symb_bool_9, sep___instr_symb_num_25);
