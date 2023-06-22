var a___instr_obj_11 = {};
var a____any_property___instr_obj_10 = {};
var a____any_property____any_property___instr_symb_obj_11 = esl_symbolic.object("a____any_property____any_property___instr_symb_obj_11");
instr_any_prop_10 = esl_symbolic.string("instr_any_prop_10")
a____any_property___instr_obj_10[instr_any_prop_10] = a____any_property____any_property___instr_symb_obj_11;
instr_any_prop_11 = esl_symbolic.string("instr_any_prop_11")
a___instr_obj_11[instr_any_prop_11] = a____any_property___instr_obj_10;
var b___instr_obj_12 = {};
var b____any_property___instr_array_10 = []
var b____any_property___instr_array_10__0___instr_symb_obj_12 = esl_symbolic.object("b____any_property___instr_array_10__0___instr_symb_obj_12");
b____any_property___instr_array_10.push(b____any_property___instr_array_10__0___instr_symb_obj_12);
var b____any_property___instr_array_10__1___instr_symb_obj_13 = esl_symbolic.object("b____any_property___instr_array_10__1___instr_symb_obj_13");
b____any_property___instr_array_10.push(b____any_property___instr_array_10__1___instr_symb_obj_13);
var b____any_property___instr_array_10__2___instr_symb_obj_14 = esl_symbolic.object("b____any_property___instr_array_10__2___instr_symb_obj_14");
b____any_property___instr_array_10.push(b____any_property___instr_array_10__2___instr_symb_obj_14);
instr_any_prop_12 = esl_symbolic.string("instr_any_prop_12")
b___instr_obj_12[instr_any_prop_12] = b____any_property___instr_array_10;

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

extend(a___instr_obj_11, b___instr_obj_12);
