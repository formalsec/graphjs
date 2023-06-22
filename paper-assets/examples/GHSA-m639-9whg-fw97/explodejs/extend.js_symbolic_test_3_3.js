var a___instr_array_5 = []
var a___instr_array_5__0___instr_symb_str_15 = esl_symbolic.string("a___instr_array_5__0___instr_symb_str_15");
a___instr_array_5.push(a___instr_array_5__0___instr_symb_str_15);
var a___instr_array_5__1___instr_symb_str_16 = esl_symbolic.string("a___instr_array_5__1___instr_symb_str_16");
a___instr_array_5.push(a___instr_array_5__1___instr_symb_str_16);
var a___instr_array_5__2___instr_symb_str_17 = esl_symbolic.string("a___instr_array_5__2___instr_symb_str_17");
a___instr_array_5.push(a___instr_array_5__2___instr_symb_str_17);
var b___instr_obj_8 = {};
var b____any_property___instr_array_6 = []
var b____any_property___instr_array_6__0___instr_symb_obj_7 = esl_symbolic.object("b____any_property___instr_array_6__0___instr_symb_obj_7");
b____any_property___instr_array_6.push(b____any_property___instr_array_6__0___instr_symb_obj_7);
var b____any_property___instr_array_6__1___instr_symb_obj_8 = esl_symbolic.object("b____any_property___instr_array_6__1___instr_symb_obj_8");
b____any_property___instr_array_6.push(b____any_property___instr_array_6__1___instr_symb_obj_8);
var b____any_property___instr_array_6__2___instr_symb_obj_9 = esl_symbolic.object("b____any_property___instr_array_6__2___instr_symb_obj_9");
b____any_property___instr_array_6.push(b____any_property___instr_array_6__2___instr_symb_obj_9);
instr_any_prop_8 = esl_symbolic.string("instr_any_prop_8")
b___instr_obj_8[instr_any_prop_8] = b____any_property___instr_array_6;

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

extend(a___instr_array_5, b___instr_obj_8);
