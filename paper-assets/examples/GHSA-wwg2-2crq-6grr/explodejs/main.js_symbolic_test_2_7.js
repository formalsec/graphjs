var obj___instr_array_26 = []
var obj___instr_array_26__0___instr_symb_str_86 = esl_symbolic.string("obj___instr_array_26__0___instr_symb_str_86");
obj___instr_array_26.push(obj___instr_array_26__0___instr_symb_str_86);
var obj___instr_array_26__1___instr_symb_str_87 = esl_symbolic.string("obj___instr_array_26__1___instr_symb_str_87");
obj___instr_array_26.push(obj___instr_array_26__1___instr_symb_str_87);
var obj___instr_array_26__2___instr_symb_str_88 = esl_symbolic.string("obj___instr_array_26__2___instr_symb_str_88");
obj___instr_array_26.push(obj___instr_array_26__2___instr_symb_str_88);
var parts___instr_array_27 = []
var parts___instr_array_27__0___instr_symb_str_89 = esl_symbolic.string("parts___instr_array_27__0___instr_symb_str_89");
parts___instr_array_27.push(parts___instr_array_27__0___instr_symb_str_89);
var parts___instr_array_27__1___instr_symb_str_90 = esl_symbolic.string("parts___instr_array_27__1___instr_symb_str_90");
parts___instr_array_27.push(parts___instr_array_27__1___instr_symb_str_90);
var parts___instr_array_27__2___instr_symb_str_91 = esl_symbolic.string("parts___instr_array_27__2___instr_symb_str_91");
parts___instr_array_27.push(parts___instr_array_27__2___instr_symb_str_91);
var length___instr_symb_num_39 = esl_symbolic.number("length___instr_symb_num_39");
var val___instr_obj_59 = {};

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

set(obj___instr_array_26, parts___instr_array_27, length___instr_symb_num_39, val___instr_obj_59);
