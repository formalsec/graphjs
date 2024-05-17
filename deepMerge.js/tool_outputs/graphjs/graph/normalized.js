'use strict';
const v1 = { value: true };
const v2 = Object.defineProperty(exports, '__esModule', v1);
v2;
const predicates_1 = require('./predicates');
const deepMerge = function (target, source) {
    const v3 = source === undefined;
    const v4 = source === null;
    const v5 = v3 || v4;
    if (v5) {
        return target;
    }
    let key;
    const v6 = Object.keys(source);
    for (key of v6) {
        const v7 = source[key];
        const v8 = v7 === undefined;
        if (v8) {
            continue;
        }
        const v9 = target[key];
        const v10 = source[key];
        const v11 = predicates_1.isObject(v10);
        const v12 = v9 && v11;
        if (v12) {
            const v13 = target[key];
            const v14 = source[key];
            const v15 = deepMerge(v13, v14);
            v15;
        } else {
            const v16 = source[key];
            target[key] = v16;
        }
    }
    return target;
};
exports.deepMerge = deepMerge;