var key___instr_array_0 = []
var key___instr_array_0__0___instr_symb_str_0 = esl_symbolic.string("key___instr_array_0__0___instr_symb_str_0");
key___instr_array_0.push(key___instr_array_0__0___instr_symb_str_0);
var key___instr_array_0__1___instr_symb_str_1 = esl_symbolic.string("key___instr_array_0__1___instr_symb_str_1");
key___instr_array_0.push(key___instr_array_0__1___instr_symb_str_1);
var key___instr_array_0__2___instr_symb_str_2 = esl_symbolic.string("key___instr_array_0__2___instr_symb_str_2");
key___instr_array_0.push(key___instr_array_0__2___instr_symb_str_2);

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

v20(key___instr_array_0);
