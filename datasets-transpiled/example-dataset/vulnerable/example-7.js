// testing renamed to eval call

module.exports = function f(x) {
    const c = eval;
    return c(x);
};