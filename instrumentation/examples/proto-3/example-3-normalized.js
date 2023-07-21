const merge = function (target, source) {
    for (key in source) {
        value = source[key];
        const v1 = typeof value;
        const v2 = v1 === 'object';
        const v3 = value && v2;
        if (v3) {
            const v4 = target[key];
            const v5 = merge(v4, value);
            v5;
        } else {
            target[key] = value;
        }
    }
};
module.exports = merge;