var y__instr_symb_0 = symb(y__instr_symb_0);

const f = function (y) {
	let x = {};
	x.f = y;
	const v1 = x.f;
	const instr_test_0 = !is_symbolic(v1);
	Assert(instr_test_0);
	const v2 = eval(v1);
	return v2;
};

f(y__instr_symb_0);
