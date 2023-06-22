var a___instr_obj_7 = {};
var a____any_property___instr_obj_6 = {};
var a____any_property____any_property___instr_symb_obj_6 = esl_symbolic.object("a____any_property____any_property___instr_symb_obj_6");
instr_any_prop_6 = esl_symbolic.string("instr_any_prop_6")
a____any_property___instr_obj_6[instr_any_prop_6] = a____any_property____any_property___instr_symb_obj_6;
instr_any_prop_7 = esl_symbolic.string("instr_any_prop_7")
a___instr_obj_7[instr_any_prop_7] = a____any_property___instr_obj_6;
var b___instr_array_4 = []
var b___instr_array_4__0___instr_symb_str_12 = esl_symbolic.string("b___instr_array_4__0___instr_symb_str_12");
b___instr_array_4.push(b___instr_array_4__0___instr_symb_str_12);
var b___instr_array_4__1___instr_symb_str_13 = esl_symbolic.string("b___instr_array_4__1___instr_symb_str_13");
b___instr_array_4.push(b___instr_array_4__1___instr_symb_str_13);
var b___instr_array_4__2___instr_symb_str_14 = esl_symbolic.string("b___instr_array_4__2___instr_symb_str_14");
b___instr_array_4.push(b___instr_array_4__2___instr_symb_str_14);

const extend = function (a, b) {
	const v1 = a == null;
	const v2 = b == null;
	const v3 = v1 || v2;
	if (v3) {
		return a;
	}
	const v4 = Object.keys(b);
	const v20 = function (key) {
		const v5 = Object.prototype;
		const v6 = v5.toString;
		const v7 = b[key];
		const v8 = v6.call(v7);
		const v9 = v8 == '[object Object]';
		if (v9) {
			const v10 = Object.prototype;
			const v11 = v10.toString;
			const v12 = a[key];
			const v13 = v11.call(v12);
			const v14 = v13 != '[object Object]';
			if (v14) {
				const v15 = b[key];
				a[key] = v15;
			} else {
				const v16 = a[key];
				const v17 = b[key];
				const v18 = extend(v16, v17);
				a[key] = v18;
			}
		} else {
			const v19 = b[key];
			a[key] = v19;
		}
	};
	const v21 = v4.forEach(v20);
	v21;
	return a;
};

extend(a___instr_obj_7, b___instr_array_4);
