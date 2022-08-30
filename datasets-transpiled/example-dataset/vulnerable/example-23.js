module.exports = function f(x) {
    return function () {
        return eval(x);
    };
};