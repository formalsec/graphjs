const f = function (p) {
    const a = {};
    a.b = p;
    const c = a.b;
    const v1 = eval(c);
    return v1;
};
module.exports = f;