var a___instr_obj_21 = {};
var a____any_property___instr_obj_20 = {};
var a____any_property____any_property___instr_symb_obj_22 = esl_symbolic.object("a____any_property____any_property___instr_symb_obj_22");
instr_any_prop_20 = esl_symbolic.string("instr_any_prop_20")
a____any_property___instr_obj_20[instr_any_prop_20] = a____any_property____any_property___instr_symb_obj_22;
instr_any_prop_21 = esl_symbolic.string("instr_any_prop_21")
a___instr_obj_21[instr_any_prop_21] = a____any_property___instr_obj_20;
var b___instr_obj_22 = {};
var b____any_property___instr_array_17 = []
var b____any_property___instr_array_17__0___instr_symb_obj_23 = esl_symbolic.object("b____any_property___instr_array_17__0___instr_symb_obj_23");
b____any_property___instr_array_17.push(b____any_property___instr_array_17__0___instr_symb_obj_23);
var b____any_property___instr_array_17__1___instr_symb_obj_24 = esl_symbolic.object("b____any_property___instr_array_17__1___instr_symb_obj_24");
b____any_property___instr_array_17.push(b____any_property___instr_array_17__1___instr_symb_obj_24);
var b____any_property___instr_array_17__2___instr_symb_obj_25 = esl_symbolic.object("b____any_property___instr_array_17__2___instr_symb_obj_25");
b____any_property___instr_array_17.push(b____any_property___instr_array_17__2___instr_symb_obj_25);
instr_any_prop_22 = esl_symbolic.string("instr_any_prop_22")
b___instr_obj_22[instr_any_prop_22] = b____any_property___instr_array_17;

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

extend(a___instr_obj_21, b___instr_obj_22);
