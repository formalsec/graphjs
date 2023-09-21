var nested___instr_symb_num_1 = esl_symbolic.number("nested___instr_symb_num_1");

var common = require('../common');
const v8 = function (options) {
	const v1 = {};
	options = options || v1;
	this.type = 'memory';
	this.store = {};
	this.mtimes = {};
	this.readOnly = false;
	const v2 = options.loadFrom;
	this.loadFrom = v2 || null;
	const v3 = options.logicalSeparator;
	this.logicalSeparator = v3 || ':';
	const v4 = options.parseValues;
	this.parseValues = v4 || false;
	const v5 = this.loadFrom;
	if (v5) {
		const v6 = this.loadFrom;
		const v7 = common.loadFilesSync(v6);
		this.store = v7;
	}
};
exports.Memory = v8;
var Memory = exports.Memory;
const v19 = function (key) {
	var target = this.store;
	const v10 = this.logicalSeparator;
	var path = common.path(key, v10);
	const v11 = path.length;
	let v12 = v11 > 0;
	while (v12) {
		key = path.shift();
		const v13 = typeof target;
		const v14 = v13 !== 'string';
		const v15 = target && v14;
		const v16 = Object.hasOwnProperty;
		const v17 = v16.call(target, key);
		const v18 = v15 && v17;
		if (v18) {
			target = target[key];
			continue;
		}
		return undefined;
		v12 = v11 > 0;
	}
	return target;
};
v9.get = v19;
const v42 = function (key, value) {
	const v21 = this.readOnly;
	if (v21) {
		return false;
	}
	var target = this.store;
	const v22 = this.logicalSeparator;
	var path = common.path(key, v22);
	const v23 = path.length;
	const v24 = v23 === 0;
	if (v24) {
		const v25 = !value;
		const v26 = typeof value;
		const v27 = v26 !== 'object';
		const v28 = v25 || v27;
		if (v28) {
			return false;
		} else {
			const v29 = this.reset();
			v29;
			this.store = value;
			return true;
		}
	}
	const v31 = Date.now();
	v30[key] = v31;
	const v32 = path.length;
	let v33 = v32 > 1;
	while (v33) {
		key = path.shift();
		const v34 = target[key];
		const v35 = !v34;
		const v36 = target[key];
		const v37 = typeof v36;
		const v38 = v37 !== 'object';
		const v39 = v35 || v38;
		if (v39) {
			target[key] = {};
		}
		target = target[key];
		v33 = v32 > 1;
	}
	key = path.shift();
	const v40 = this.parseValues;
	if (v40) {
		const v41 = common.parseValues;
		value = v41.call(common, value);
	}
	target[key] = value;
	return true;
};
v20.set = v42;
const v60 = function (key) {
	const v44 = this.readOnly;
	if (v44) {
		return false;
	}
	var target = this.store;
	var value = target;
	const v45 = this.logicalSeparator;
	var path = common.path(key, v45);
	const v46 = this.mtimes;
	const v47 = v46[key];
	const v48 = delete v47;
	v48;
	var i = 0;
	const v49 = path.length;
	const v50 = v49 - 1;
	let v51 = i < v50;
	while (v51) {
		key = path[i];
		value = target[key];
		const v53 = typeof value;
		const v54 = v53 !== 'function';
		const v55 = typeof value;
		const v56 = v55 !== 'object';
		const v57 = v54 && v56;
		if (v57) {
			return false;
		}
		target = value;
		const v52 = i++;
		v51 = i < v50;
	}
	key = path[i];
	const v58 = target[key];
	const v59 = delete v58;
	v59;
	return true;
};
v43.clear = v60;
const v90 = function (key, value) {
	const v62 = this.readOnly;
	if (v62) {
		return false;
	}
	const v63 = typeof value;
	const v64 = v63 !== 'object';
	const v65 = Array.isArray(value);
	const v66 = v64 || v65;
	const v67 = value === null;
	const v68 = v66 || v67;
	if (v68) {
		const v69 = this.set(key, value);
		return v69;
	}
	var self = this;
	var target = this.store;
	const v70 = this.logicalSeparator;
	var path = common.path(key, v70);
	var fullKey = key;
	const v72 = Date.now();
	v71[key] = v72;
	const v73 = path.length;
	let v74 = v73 > 1;
	while (v74) {
		key = path.shift();
		const v75 = target[key];
		const v76 = !v75;
		if (v76) {
			target[key] = {};
		}
		target = target[key];
		v74 = v73 > 1;
	}
	key = path.shift();
	const v77 = target[key];
	const v78 = typeof v77;
	const v79 = v78 !== 'object';
	const v80 = target[key];
	const v81 = Array.isArray(v80);
	const v82 = v79 || v81;
	if (v82) {
		target[key] = value;
		return true;
	}
	const v83 = Object.keys(value);
	const v88 = function (nested) {
		const v84 = self.logicalSeparator;
		const v85 = common.keyed(v84, fullKey, nested);
		const v86 = value[nested];
		const v87 = self.merge(v85, v86);
		return v87;
	};
	const v89 = v83.every(v88);
	return v89;
};
v61.merge = v90;
const v93 = function () {
	const v92 = this.readOnly;
	if (v92) {
		return false;
	}
	this.mtimes = {};
	this.store = {};
	return true;
};
v91.reset = v93;
const v98 = function () {
	const v95 = this.store;
	const v96 = {};
	const v97 = v95 || v96;
	return v97;
};
v94.loadSync = v98;

v88(nested___instr_symb_num_1);
