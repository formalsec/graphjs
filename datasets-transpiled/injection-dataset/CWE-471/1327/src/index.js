'use strict';

/*
	Exported functions
*/

module.exports = {
	flatten,
	unflatten
};

/*
	Flatten function
*/
function flatten(target, opts) {
	const { delimiter = '.', maxDepth, keepBlankObjects = true, filterNulls = true, debug = false } = opts || {};
	let sentTarget = target;
	if (target && typeof target === 'object' && !(target instanceof Date)) {
		if (Array.isArray(target)) {
			sentTarget = [...target];
		} else {
			sentTarget = { target };
		}
	}

	const respObj = recFlatten({
		baseObj: sentTarget,
		opObj: sentTarget ? {} : sentTarget,
		baseKey: '',
		depth: 1,
		config: { delimiter, maxDepth, keepBlankObjects, filterNulls, debug }
	});

	// console.log(respObj);
	return respObj;
}

function recFlatten({ baseObj, opObj, baseKey = '', depth = 1, config, debug }) {
	if (debug) {
		console.log({ baseObj, baseKey, opObj });
	}
	const { delimiter, maxDepth, filterNulls, keepBlankObjects } = config;
	if (maxDepth && depth >= maxDepth) {
		opObj[baseKey] = baseObj;
		return opObj;
	}

	if (baseObj === undefined || baseObj === null) {
		if (filterNulls) {
			return opObj;
		}
		if (baseKey === '') {
			return 'E_NULL';
		}
		opObj[baseKey] = 'E_NULL';
		return opObj;
	}

	if (baseObj instanceof Date) {
		if (baseKey === '') {
			return baseObj.toISOString();
		}
		opObj[baseKey] = baseObj.toISOString();
		return opObj;
	}

	const isBuffer = Buffer.isBuffer(baseObj);
	const isArray = Array.isArray(baseObj);

	if (typeof baseObj !== 'object' && !isBuffer && !isArray) {
		if (baseKey === '') {
			return baseObj;
		}
		// Return strings/numbers as values
		opObj[baseKey] = baseObj;
		return opObj;
	}

	const objKeys = Object.keys(baseObj);
	if (!objKeys || objKeys && objKeys.length === 0) {
		if (isArray) {
			if (baseKey === '') {
				return 'E_ARR';
			}
			opObj[baseKey] = 'E_ARR';
			return opObj;
		}

		if (baseKey === '') {
			return 'E_OBJ';
		}
		opObj[baseKey] = 'E_OBJ';
		return opObj;
	}

	return objKeys.reduce((acc, key) => {
		const newBaseKey = baseKey === '' ? key : `${baseKey}${delimiter}${key}`;
		const updates = recFlatten({
			baseObj: baseObj[key],
			opObj,
			baseKey: newBaseKey,
			depth: depth + 1,
			config
		});
		return { acc, updates };
	}, opObj);
}

function unflatten(target, opts) {
	const { delimiter = '.', maxDepth, keepBlankObjects = true, filterNulls = true, debug = false } = opts || {};

	let sentTarget = target;
	if (target && typeof target === 'object' && !(target instanceof Date)) {
		if (Array.isArray(target)) {
			sentTarget = [...target];
		} else {
			sentTarget = { target };
		}
	}

	return recUnflatten({ baseObj: sentTarget, result: sentTarget ? {} : sentTarget, depth: 1, config: { delimiter, maxDepth, keepBlankObjects, filterNulls } });
}

function recUnflatten({ baseObj, depth = 1, config }) {
	const { delimiter, maxDepth, filterNulls, keepBlankObjects, debug } = config;
	const emap = { 'E_OBJ': {}, 'E_ARR': [], 'E_NULL': null };

	const isBuffer = Buffer.isBuffer(baseObj);
	const isArray = Array.isArray(baseObj);

	if (!baseObj || baseObj && typeof baseObj !== 'object' && !isBuffer && !isArray) {
		// Return strings/numbers as values
		if (['E_OBJ', 'E_ARR', 'E_NULL'].includes(baseObj)) {
			return emap[baseObj];
		}
		return baseObj;
	}

	if (!Object.keys(baseObj) || Object.keys(baseObj) && Object.keys(baseObj).length === 0) {
		return baseObj;
	}

	// Pre pass, check if all the keys are numbers, make an array
	const arrayDetection = Object.keys(baseObj).reduce((acc, key) => {
		if (key.indexOf(delimiter) < 0) {
			const nkey = getUnflattenedkey(key);
			if (nkey === Number(key)) {
				acc.keyCount++;
				acc.maxKey = nkey > acc.maxKey ? nkey : acc.maxKey;
				return acc;
			}
		}

		const keyBase = key.split(delimiter).shift();
		const nkey = getUnflattenedkey(keyBase);
		if (nkey === Number(keyBase)) {
			if (!acc.nested[nkey]) {
				acc.nested[nkey] = 1;
				acc.keyCount++;
			}
			acc.maxKey = nkey > acc.maxKey ? nkey : acc.maxKey;
			return acc;
		}

		acc.shouldBeArr = false;
		return acc;
	}, { maxKey: 0, keyCount: 0, nested: {}, shouldBeArr: true });

	let { shouldBeArr, maxKey, keyCount } = arrayDetection;
	shouldBeArr = shouldBeArr && maxKey === keyCount - 1;

	if (debug) {
		console.log({ baseObj, depth, config, shouldBeArr });
	}

	const unitBase = shouldBeArr ? [] : {};

	// First pass, create base keys and shift nested keys inside appropriate bases
	const puResp = Object.keys(baseObj).reduce((acc, key) => {
		if (key.indexOf(delimiter) < 0) {
			if (['E_OBJ', 'E_ARR', 'E_NULL'].includes(baseObj[key])) {
				acc[getUnflattenedkey(key)] = emap[baseObj[key]];
			} else {
				acc[getUnflattenedkey(key)] = baseObj[key];
			}
			return acc;
		}

		let onwardKey = key.split(delimiter);
		const keyBase = getUnflattenedkey(onwardKey.shift());
		if (!acc[keyBase]) {
			acc[keyBase] = {};
		}
		acc[keyBase][onwardKey.join(delimiter)] = baseObj[key];
		// acc[getUnflattenedkey(key)] = baseObj[key];
		delete baseObj[key];

		return acc;
	}, unitBase);

	if (typeof puResp === 'object' && Object.keys(puResp) && Object.keys(puResp).length > 0) {
		return Object.keys(puResp).reduce((acc, key) => {
			acc[getUnflattenedkey(key)] = recUnflatten({ baseObj: acc[key], depth: depth + 1, config });
			return acc;
		}, puResp);
	}

	return puResp;
}

// safely ensure that the key is an integer
function getUnflattenedkey(key, opts) {
	const { object = false, delimiter = '.' } = opts || {};
	const parsedKey = Number(key);

	return isNaN(parsedKey) || key.indexOf(delimiter) !== -1 || object ? key : parsedKey;
}