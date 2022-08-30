// tainted paremeter removed from arrays 1st position before eval call

module.exports = function f(x) {
    let arr = [x, "console.log('not vulnerable')"];
    arr.shift();
    return eval(arr[0]);
};