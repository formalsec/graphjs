var a___instr_array_12 = []
var a___instr_array_12__0___instr_symb_str_30 = esl_symbolic.string("a___instr_array_12__0___instr_symb_str_30");
a___instr_array_12.push(a___instr_array_12__0___instr_symb_str_30);
var a___instr_array_12__1___instr_symb_str_31 = esl_symbolic.string("a___instr_array_12__1___instr_symb_str_31");
a___instr_array_12.push(a___instr_array_12__1___instr_symb_str_31);
var a___instr_array_12__2___instr_symb_str_32 = esl_symbolic.string("a___instr_array_12__2___instr_symb_str_32");
a___instr_array_12.push(a___instr_array_12__2___instr_symb_str_32);
var b___instr_obj_18 = {};
var b____any_property___instr_array_13 = []
var b____any_property___instr_array_13__0___instr_symb_obj_18 = esl_symbolic.object("b____any_property___instr_array_13__0___instr_symb_obj_18");
b____any_property___instr_array_13.push(b____any_property___instr_array_13__0___instr_symb_obj_18);
var b____any_property___instr_array_13__1___instr_symb_obj_19 = esl_symbolic.object("b____any_property___instr_array_13__1___instr_symb_obj_19");
b____any_property___instr_array_13.push(b____any_property___instr_array_13__1___instr_symb_obj_19);
var b____any_property___instr_array_13__2___instr_symb_obj_20 = esl_symbolic.object("b____any_property___instr_array_13__2___instr_symb_obj_20");
b____any_property___instr_array_13.push(b____any_property___instr_array_13__2___instr_symb_obj_20);
instr_any_prop_18 = esl_symbolic.string("instr_any_prop_18")
b___instr_obj_18[instr_any_prop_18] = b____any_property___instr_array_13;

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

extend(a___instr_array_12, b___instr_obj_18);
