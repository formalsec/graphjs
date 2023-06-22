var val___instr_symb_2 = esl_symbolic.string("val___instr_symb_2");
var path___instr_symb_str_3 = esl_symbolic.string("path___instr_symb_str_3");

const isObject = function (o, allowArray) {
	const v1 = typeof o;
	const v2 = 'object' === v1;
	const v3 = o && v2;
	const v4 = Array.isArray(o);
	const v5 = !v4;
	const v6 = allowArray || v5;
	const v7 = v3 && v6;
	return v7;
};
const isBasic = function (b) {
	const v8 = typeof b;
	const v9 = 'string' === v8;
	const v10 = typeof b;
	const v11 = 'number' === v10;
	const v12 = v9 || v11;
	return v12;
};
const get = function (obj, path, dft) {
	const v13 = isObject(obj, true);
	const v14 = !v13;
	if (v14) {
		return dft;
	}
	const v15 = isBasic(path);
	if (v15) {
		const v16 = obj[path];
		return v16;
	}
	var i = 0;
	const v17 = path.length;
	let v18 = i < v17;
	while (v18) {
		const v20 = path[i];
		const v21 = null == (obj = obj[v20]);
		if (v21) {
			return dft;
		}
		const v19 = i++;
		v18 = i < v17;
	}
	return obj;
};
const isNonNegativeInteger = function (i) {
	const v22 = Number.isInteger(i);
	const v23 = i >= 0;
	const v24 = v22 && v23;
	return v24;
};
const set = function (obj, path, value) {
	const v25 = !obj;
	if (v25) {
		const v26 = new Error('libnested.set: first arg must be an object');
		throw v26;
	}
	const v27 = isBasic(path);
	if (v27) {
		return obj[path] = value;
	}
	var i = 0;
	const v28 = path.length;
	let v29 = i < v28;
	while (v29) {
		const v31 = path.length;
		const v32 = v31 - 1;
		const v33 = i === v32;
		if (v33) {
			const v34 = path[i];
			obj[v34] = value;
		} else {
			const v35 = path[i];
			const v36 = obj[v35];
			const v37 = null == v36;
			if (v37) {
				const v38 = path[i];
				const v39 = i + 1;
				const v40 = path[v39];
				const v41 = isNonNegativeInteger(v40);
				const v42 = [];
				const v43 = {};
				let v44;
				if (v41) {
					v44 = v42;
				} else {
					v44 = v43;
				}
				const v45 = obj[v38];
				obj = v45;
			} else {
				const v46 = path[i];
				const v47 = isPrototypePolluted(v46);
				const v48 = !v47;
				if (v48) {
					const v49 = path[i];
					obj = obj[v49];
				}
			}
		}
		const v30 = i++;
		v29 = i < v28;
	}
	return value;
};
const each = function (obj, iter, includeArrays, path) {
	const v50 = [];
	path = path || v50;
	const v51 = Array.isArray(obj);
	if (v51) {
		const v52 = !includeArrays;
		if (v52) {
			return false;
		}
		var k = 0;
		const v53 = obj.length;
		let v54 = k < v53;
		while (v54) {
			var v = obj[k];
			const v56 = isObject(v, includeArrays);
			if (v56) {
				const v57 = path.concat(k);
				const v58 = each(v, iter, includeArrays, v57);
				const v59 = false === v58;
				if (v59) {
					return false;
				}
			} else {
				const v60 = path.concat(k);
				const v61 = iter(v, v60);
				const v62 = false === v61;
				if (v62) {
					return false;
				}
			}
			const v55 = k++;
			v54 = k < v53;
		}
	} else {
		let k;
		for (k in obj) {
			var v = obj[k];
			const v63 = isObject(v, includeArrays);
			if (v63) {
				const v64 = path.concat(k);
				const v65 = each(v, iter, includeArrays, v64);
				const v66 = false === v65;
				if (v66) {
					return false;
				}
			} else {
				const v67 = path.concat(k);
				const v68 = iter(v, v67);
				const v69 = false === v68;
				if (v69) {
					return false;
				}
			}
		}
	}
	return true;
};
const map = function (obj, iter, out, includeArrays) {
	let out;
	const v70 = Array.isArray(obj);
	const v71 = out || v70;
	const v72 = [];
	const v73 = {};
	if (v71) {
		out = v72;
	} else {
		out = v73;
	}
	const v76 = function (val, path) {
		const v74 = iter(val, path);
		const v75 = set(out, path, v74);
		v75;
	};
	const v77 = each(obj, v76, includeArrays);
	v77;
	return out;
};
const paths = function (obj, incluedArrays) {
	var out = [];
	const v79 = function (_, path) {
		const v78 = out.push(path);
		v78;
	};
	const v80 = each(obj, v79, incluedArrays);
	v80;
	return out;
};
const id = function (e) {
	return e;
};
const clone = function (obj) {
	const v81 = isObject(obj, true);
	const v82 = !v81;
	if (v82) {
		return obj;
	}
	var _obj;
	const v83 = Array.isArray(obj);
	const v84 = [];
	const v85 = {};
	if (v83) {
		_obj = v84;
	} else {
		_obj = v85;
	}
	let k;
	for (k in obj) {
		const v86 = obj[k];
		const v87 = clone(v86);
		_obj[k] = v87;
	}
	return _obj;
};
const isPrototypePolluted = function (key) {
	const v88 = [
		'__proto__',
		'constructor',
		'prototype'
	];
	const v89 = v88.includes(key);
	return v89;
};
exports.get = get;
exports.set = set;
exports.each = each;
exports.map = map;
exports.paths = paths;
exports.clone = clone;
exports.copy = clone;

v76(val___instr_symb_2, path___instr_symb_str_3);
