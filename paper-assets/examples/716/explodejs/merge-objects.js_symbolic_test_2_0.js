var object1___instr_obj_8 = {};
var object1____any_property___instr_symb_obj_8 = esl_symbolic.object("object1____any_property___instr_symb_obj_8");
instr_any_prop_8 = esl_symbolic.string("instr_any_prop_8")
object1___instr_obj_8[instr_any_prop_8] = object1____any_property___instr_symb_obj_8;
var object2___instr_obj_9 = {};
var object2____any_property___instr_symb_obj_9 = esl_symbolic.object("object2____any_property___instr_symb_obj_9");
instr_any_prop_9 = esl_symbolic.string("instr_any_prop_9")
object2___instr_obj_9[instr_any_prop_9] = object2____any_property___instr_symb_obj_9;

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

v29(object1___instr_obj_8, object2___instr_obj_9);
