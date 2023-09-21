var object___instr_obj_3 = {};
var object____any_property___instr_obj_2 = {};
var object____any_property____any_property___instr_symb_obj_1 = esl_symbolic.object("object____any_property____any_property___instr_symb_obj_1");
instr_any_prop_2 = esl_symbolic.string("instr_any_prop_2")
object____any_property___instr_obj_2[instr_any_prop_2] = object____any_property____any_property___instr_symb_obj_1;
instr_any_prop_3 = esl_symbolic.string("instr_any_prop_3")
object___instr_obj_3[instr_any_prop_3] = object____any_property___instr_obj_2;
var keypath___instr_symb_num_0 = esl_symbolic.number("keypath___instr_symb_num_0");
var value___instr_symb_str_4 = esl_symbolic.string("value___instr_symb_str_4");

var set;
const v1 = [];
var indexOf = v1.indexOf;
const v43 = function (object, keypath, value) {
	var k;
	var kp;
	var o;
	const v2 = typeof keypath;
	const v3 = v2 === 'string';
	if (v3) {
		keypath = keypath.split('.');
	}
	const v4 = keypath instanceof Array;
	const v5 = !v4;
	if (v5) {
		const v6 = JSON.stringify(keypath);
		const v7 = 'invalid keypath: ' + v6;
		throw v7;
	}
	const v8 = [];
	kp = v8.concat(keypath);
	const v9 = indexOf.call(keypath, '__proto__');
	const v10 = v9 >= 0;
	if (v10) {
		const v11 = JSON.stringify(keypath);
		const v12 = '__proto__ in keypath: ' + v11;
		throw v12;
	}
	o = object;
	const v13 = kp.length;
	let v14 = v13 > 1;
	while (v14) {
		k = kp.shift();
		const v15 = o[k];
		const v16 = v15 == null;
		if (v16) {
			const v17 = parseInt(k);
			const v18 = Number.isNaN(v17);
			const v19 = !v18;
			if (v19) {
				const v20 = o[k];
				o = v20;
			} else {
				const v21 = o[k];
				o = v21;
			}
		} else {
			o = o[k];
		}
		v14 = v13 > 1;
	}
	const v22 = kp.length;
	const v23 = v22 === 1;
	const v24 = o != null;
	const v25 = v23 && v24;
	if (v25) {
		const v26 = void 0;
		const v27 = value === v26;
		if (v27) {
			const v28 = kp[0];
			const v29 = o[v28];
			const v30 = delete v29;
			v30;
		} else {
			const v31 = kp[0];
			o[v31] = value;
			const v32 = kp[0];
			const v33 = o[v32];
			const v34 = v33 !== value;
			if (v34) {
				const v35 = JSON.stringify(value);
				const v36 = 'couldn\'t set value ' + v35;
				const v37 = v36 + ' for keypath ';
				const v38 = keypath.join('.');
				const v39 = v37 + v38;
				const v40 = v39 + ' in ';
				const v41 = JSON.stringify(object);
				const v42 = v40 + v41;
				throw v42;
			}
		}
	}
	return object;
};
set = v43;

v43(object___instr_obj_3, keypath___instr_symb_num_0, value___instr_symb_str_4);
