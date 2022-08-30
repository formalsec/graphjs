const isPojo = o => {
	var proto = Object.getPrototypeOf(o);
	return proto === null || Object.getPrototypeOf(proto) === null;
};

const merge = (x, y) => {
	if (y === undefined) {
		return x;
	}
	if (y === null || x == null) {
		return y;
	}
	if ((isPojo(x) || Array.isArray(x)) && isPojo(y)) {
		// merge recursively y into x
		Object.keys(y).forEach(function (key) {
			x[key] = merge(x[key], y[key]);
		});
		Object.getOwnPropertySymbols(y).forEach(function (key) {
			if (Object.getOwnPropertyDescriptor(y, key).enumerable) {
				x[key] = merge(x[key], y[key]);
			}
		});
		return x;
	}
	if (Array.isArray(x) && Array.isArray(y)) {
		// concat
		return x.concat(y);
	}
	if (typeof x.add === 'function' && typeof y.add === 'function') {
		// Set-like
		y.forEach(function (value) {
			x.add(value);
		});
		return x;
	}
	if (typeof x.set === 'function' && typeof y.set === 'function') {
		// Map-like
		y.forEach(function (value, key) {
			x.set(key, merge(x.get(key), value));
		});
		return x;
	}
	// if x is a number, boolean, string, symbol, function or complex object instance, then just replace
	return y;
};

const mergify = (...o) => o.reduce((a, b) => merge(a, b));

module.exports = mergify;
mergify.default = mergify;
mergify.merge = merge;
mergify.isPojo = isPojo;