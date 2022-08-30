module.exports = function f(x) {
    this.input = x;
    return function () {
        return eval(this.input);
    };
};