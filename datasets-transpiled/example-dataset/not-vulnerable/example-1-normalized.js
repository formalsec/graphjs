const f = function (x) {
    let arr = [x, 'console.log(\'not vulnerable\')'];
    const v1 = arr.shift;
    const v2 = v1();
    v2;
    const v3 = arr[0];
    const v4 = eval(v3);
    return v4;
};
module.exports = f;