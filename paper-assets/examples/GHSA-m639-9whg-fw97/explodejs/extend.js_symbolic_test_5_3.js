var a___instr_array_19 = []
var a___instr_array_19__0___instr_symb_str_45 = esl_symbolic.string("a___instr_array_19__0___instr_symb_str_45");
a___instr_array_19.push(a___instr_array_19__0___instr_symb_str_45);
var a___instr_array_19__1___instr_symb_str_46 = esl_symbolic.string("a___instr_array_19__1___instr_symb_str_46");
a___instr_array_19.push(a___instr_array_19__1___instr_symb_str_46);
var a___instr_array_19__2___instr_symb_str_47 = esl_symbolic.string("a___instr_array_19__2___instr_symb_str_47");
a___instr_array_19.push(a___instr_array_19__2___instr_symb_str_47);
var b___instr_obj_28 = {};
var b____any_property___instr_array_20 = []
var b____any_property___instr_array_20__0___instr_symb_obj_29 = esl_symbolic.object("b____any_property___instr_array_20__0___instr_symb_obj_29");
b____any_property___instr_array_20.push(b____any_property___instr_array_20__0___instr_symb_obj_29);
var b____any_property___instr_array_20__1___instr_symb_obj_30 = esl_symbolic.object("b____any_property___instr_array_20__1___instr_symb_obj_30");
b____any_property___instr_array_20.push(b____any_property___instr_array_20__1___instr_symb_obj_30);
var b____any_property___instr_array_20__2___instr_symb_obj_31 = esl_symbolic.object("b____any_property___instr_array_20__2___instr_symb_obj_31");
b____any_property___instr_array_20.push(b____any_property___instr_array_20__2___instr_symb_obj_31);
instr_any_prop_28 = esl_symbolic.string("instr_any_prop_28")
b___instr_obj_28[instr_any_prop_28] = b____any_property___instr_array_20;

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

extend(a___instr_array_19, b___instr_obj_28);
