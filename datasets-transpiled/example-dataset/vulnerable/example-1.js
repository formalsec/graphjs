// testing taint from parameter to object property to eval call

module.exports = function f(y) {
    let x = {};
    x.f = y;
    return eval(x.f);
};