// testing taint by reference

module.exports = function f(p) {
    const a = [0, 0];
    const c = a;
    a[0] = p;
    return eval(c[0]);
};