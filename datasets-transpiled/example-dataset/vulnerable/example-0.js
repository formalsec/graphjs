// testing taint from parameter to eval function call

module.exports = function f(x, y) {
    return eval(x);
};