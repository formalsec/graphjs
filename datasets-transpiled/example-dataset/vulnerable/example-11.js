// testing taint by reference

module.exports = function f(p) {
    const a = {
        b: p
    };
    const c = a.b;
    return eval(c);
};