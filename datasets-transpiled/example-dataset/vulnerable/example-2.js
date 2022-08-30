// testing object reference copy
// taint from parameter to object property to eval call

module.exports = function f(y) {
    let x = {};
    x.f = y;
    let o = x;
    return eval(o.f);
};