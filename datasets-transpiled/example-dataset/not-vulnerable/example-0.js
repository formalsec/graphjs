// tainted paremeter not accessed in the for loop

module.exports = function f(x) {
    let arr = [x, "console.log('not vulnerable')"];
    for (let i = 1; i < arr.length; i++) {
        eval(arr[i]);
    }
};