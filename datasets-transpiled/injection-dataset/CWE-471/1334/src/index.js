'use strict';

Object.defineProperty(exports, '__esModule', { value: true });
exports.setDeep = exports.getDeep = void 0;
// Import
const typechecker_1 = require('typechecker');
/** Get a nested value within the subject */
function getDeep(subject, keys) {
	// Split keys if they are a string
	if (typeof keys === 'string') {
		keys = keys.split('.');
	}
	// Return if we have no keys
	if (keys.length === 0) {
		return;
	}
	// Return if we have no object
	if (!subject) {
		return;
	}
	// Return if we are not a delveable type like object or function
	if (!typechecker_1.isObject(subject) && !typechecker_1.isFunction(subject)) {
		return;
	}
	// Get the deepmost item
	for (let i = 0, n = keys.length - 1; i < n; ++i) {
		const key = keys[i];
		subject = getDeep(subject, key);
		if (!subject) {
			return;
		}
	}
	// We've gotten the deepmost item, get the value now
	const key = keys[keys.length - 1];
	const result = subject.get != null ? subject.get(key) : subject[key];
	// Return
	return result;
}
exports.getDeep = getDeep;
/** Set a nested value within the subject */
function setDeep(subject, keys, value, opts = {}) {
	// Prepare
	if (opts.onlyIfEmpty == null) {
		opts.onlyIfEmpty = false;
	}
	// Split keys if they are a string
	if (typeof keys === 'string') {
		keys = keys.split('.');
	}
	// Check
	if (keys.length === 0) {
		return;
	}
	// Get the deepmost item
	for (let i = 0, n = keys.length - 1; i < n; ++i) {
		const key = keys[i];
		const tmp = getDeep(subject, key);
		if (tmp) {
			subject = tmp;
		} else {
			subject = setDeep(subject, key, {}, opts);
		}
	}
	// We've gotten the deepmost item, set the value now
	const key = keys[keys.length - 1];
	let result = getDeep(subject, key);
	if (!opts.onlyIfEmpty || result == null) {
		// model
		if (subject.set != null) {
			const attrs = {};
			attrs[key] = value;
			subject.set(attrs, opts);
		} else {
			// object
			subject[key] = value;
		}
	}
	// Fetch the actual applied value, could be different than what we set
	result = getDeep(subject, key);
	// Return
	return result;
}
exports.setDeep = setDeep;