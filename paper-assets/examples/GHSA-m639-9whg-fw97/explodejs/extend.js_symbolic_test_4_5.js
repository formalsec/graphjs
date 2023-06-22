var a___instr_array_15 = []
var a___instr_array_15__0___instr_symb_str_36 = esl_symbolic.string("a___instr_array_15__0___instr_symb_str_36");
a___instr_array_15.push(a___instr_array_15__0___instr_symb_str_36);
var a___instr_array_15__1___instr_symb_str_37 = esl_symbolic.string("a___instr_array_15__1___instr_symb_str_37");
a___instr_array_15.push(a___instr_array_15__1___instr_symb_str_37);
var a___instr_array_15__2___instr_symb_str_38 = esl_symbolic.string("a___instr_array_15__2___instr_symb_str_38");
a___instr_array_15.push(a___instr_array_15__2___instr_symb_str_38);
var b___instr_array_16 = []
var b___instr_array_16__0___instr_symb_str_39 = esl_symbolic.string("b___instr_array_16__0___instr_symb_str_39");
b___instr_array_16.push(b___instr_array_16__0___instr_symb_str_39);
var b___instr_array_16__1___instr_symb_str_40 = esl_symbolic.string("b___instr_array_16__1___instr_symb_str_40");
b___instr_array_16.push(b___instr_array_16__1___instr_symb_str_40);
var b___instr_array_16__2___instr_symb_str_41 = esl_symbolic.string("b___instr_array_16__2___instr_symb_str_41");
b___instr_array_16.push(b___instr_array_16__2___instr_symb_str_41);

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

extend(a___instr_array_15, b___instr_array_16);
