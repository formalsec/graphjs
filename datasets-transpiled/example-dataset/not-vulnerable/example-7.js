module.exports = function f(x) {
    a = [0, 0];
    c = a;
    a[0] = x;
    a[0] = "console.log('not vulnerable')";
    return eval(c[0]);
};