module.exports = function f(x) {
    const evalArgs = true ? x : x.split(' ');
    return eval(evalArgs);
};