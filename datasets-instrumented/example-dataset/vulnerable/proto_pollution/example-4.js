var path___instr_array_0 = [];
var path__0__instr_symb_str_0 = symb_string(path__0__instr_symb_str_0);
Assume(not(path__0__instr_symb_str_0 = "valueOf"));
Assume(not(path__0__instr_symb_str_0 = "toString"));
Assume(not(path__0__instr_symb_str_0 = "hasOwnProperty"));
Assume(not(path__0__instr_symb_str_0 = "constructor"));
path___instr_array_0.push(path__0__instr_symb_str_0);
var path__1__instr_symb_str_1 = symb_string(path__1__instr_symb_str_1);
Assume(not(path__1__instr_symb_str_1 = "valueOf"));
Assume(not(path__1__instr_symb_str_1 = "toString"));
Assume(not(path__1__instr_symb_str_1 = "hasOwnProperty"));
Assume(not(path__1__instr_symb_str_1 = "constructor"));
path___instr_array_0.push(path__1__instr_symb_str_1);
var value___instr_symb_0 = symb(value___instr_symb_0);

const f = function (path, value) {
	obj = {};
	var i = 0;
	const v1 = path.length;
	let v2 = i < v1;
	while (v2) {
		const key = path[i];
		const v4 = path.length;
		const v5 = v4 - 1;
		const v6 = i === v5;
		if (v6) {
			obj[key] = value;
		}
		obj = obj[key];
		const v3 = i++;
		v2 = i < v1;
	}
};

f(path___instr_array_0, value___instr_symb_0);
