const f = function (x) {
    const v1 = isNaN(x);
    if (v1) {
        return 'not vulnerable (NaN)';
    }
    const v2 = x >= 0;
    if (v2) {
        return 'not vulnerable (>= 0)';
    } else {
        const v3 = x < 0;
        if (v3) {
            return 'not vulnerable (< 0)';
        } else {
            const v4 = eval(x);
            return v4;
        }
    }
};
module.exports = f;