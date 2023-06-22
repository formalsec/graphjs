var obj___instr_array_4 = []
var obj___instr_array_4__0___instr_symb_str_14 = esl_symbolic.string("obj___instr_array_4__0___instr_symb_str_14");
obj___instr_array_4.push(obj___instr_array_4__0___instr_symb_str_14);
var obj___instr_array_4__1___instr_symb_str_15 = esl_symbolic.string("obj___instr_array_4__1___instr_symb_str_15");
obj___instr_array_4.push(obj___instr_array_4__1___instr_symb_str_15);
var obj___instr_array_4__2___instr_symb_str_16 = esl_symbolic.string("obj___instr_array_4__2___instr_symb_str_16");
obj___instr_array_4.push(obj___instr_array_4__2___instr_symb_str_16);
var path___instr_array_5 = []
var path___instr_array_5__0___instr_symb_str_17 = esl_symbolic.string("path___instr_array_5__0___instr_symb_str_17");
path___instr_array_5.push(path___instr_array_5__0___instr_symb_str_17);
var path___instr_array_5__1___instr_symb_str_18 = esl_symbolic.string("path___instr_array_5__1___instr_symb_str_18");
path___instr_array_5.push(path___instr_array_5__1___instr_symb_str_18);
var path___instr_array_5__2___instr_symb_str_19 = esl_symbolic.string("path___instr_array_5__2___instr_symb_str_19");
path___instr_array_5.push(path___instr_array_5__2___instr_symb_str_19);
var val___instr_symb_bool_4 = esl_symbolic.function("val___instr_symb_bool_4");
var sep___instr_symb_num_12 = esl_symbolic.number("sep___instr_symb_num_12");

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

v28(obj___instr_array_4, path___instr_array_5, val___instr_symb_bool_4, sep___instr_symb_num_12);
