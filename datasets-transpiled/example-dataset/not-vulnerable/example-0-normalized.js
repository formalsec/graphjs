const f = function (x) {
    let arr = [x, 'console.log(\'not vulnerable\')'];
    let i = 1;
    const v1 = arr.length;
    let v2 = i < v1;
    while (v2) {
        const v4 = arr[i];
        const v5 = eval(v4);
        v5;
        const v3 = i++;
        v2 = i < v1;
    }
};
module.exports = f;