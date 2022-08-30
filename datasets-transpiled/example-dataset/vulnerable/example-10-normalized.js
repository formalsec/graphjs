const f = function (p) {
    const a = [0, 0];
    const c = a;
    a[0] = p;
    const v1 = c[0];
    const v2 = eval(v1);
    return v2;
};
module.exports = f;