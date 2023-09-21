var object1___instr_array_5 = []
var object1___instr_array_5__0___instr_symb_str_15 = esl_symbolic.string("object1___instr_array_5__0___instr_symb_str_15");
object1___instr_array_5.push(object1___instr_array_5__0___instr_symb_str_15);
var object1___instr_array_5__1___instr_symb_str_16 = esl_symbolic.string("object1___instr_array_5__1___instr_symb_str_16");
object1___instr_array_5.push(object1___instr_array_5__1___instr_symb_str_16);
var object1___instr_array_5__2___instr_symb_str_17 = esl_symbolic.string("object1___instr_array_5__2___instr_symb_str_17");
object1___instr_array_5.push(object1___instr_array_5__2___instr_symb_str_17);
var object2___instr_obj_7 = {};
var object2____any_property___instr_symb_obj_7 = esl_symbolic.object("object2____any_property___instr_symb_obj_7");
instr_any_prop_7 = esl_symbolic.string("instr_any_prop_7")
object2___instr_obj_7[instr_any_prop_7] = object2____any_property___instr_symb_obj_7;

var mergeObjects;
const v29 = function (object1, object2) {
	var key;
	const v1 = typeof object1;
	const v2 = v1 !== 'object';
	if (v2) {
		const v3 = typeof object2;
		const v4 = v3 !== 'object';
		if (v4) {
			const v5 = [
				object1,
				object2
			];
			return v5;
		}
		const v6 = object2.concat(object1);
		return v6;
	}
	const v7 = typeof object2;
	const v8 = v7 !== 'object';
	if (v8) {
		const v9 = object1.concat(object2);
		return v9;
	}
	for (key in object2) {
		const v10 = object1[key];
		const v11 = Array.isArray(v10);
		const v12 = object2[key];
		const v13 = Array.isArray(v12);
		const v14 = v11 && v13;
		if (v14) {
			const v15 = object1[key];
			const v16 = object2[key];
			const v17 = v15.concat(v16);
			object1[key] = v17;
		} else {
			const v18 = object1[key];
			const v19 = typeof v18;
			const v20 = v19 === 'object';
			const v21 = object2[key];
			const v22 = typeof v21;
			const v23 = v22 === 'object';
			const v24 = v20 && v23;
			if (v24) {
				const v25 = object1[key];
				const v26 = object2[key];
				const v27 = mergeObjects(v25, v26);
				object1[key] = v27;
			} else {
				const v28 = object2[key];
				object1[key] = v28;
			}
		}
	}
	return object1;
};
mergeObjects = v29;

v29(object1___instr_array_5, object2___instr_obj_7);
