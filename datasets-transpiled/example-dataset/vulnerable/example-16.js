// testing taint from parameter to object property to eval call
// sink argument is a template string

module.exports = function f(x) {
    return eval(`${x}`);
};