const f = function (x) {
    a = [0, 0];
    c = a;
    a[0] = x;
    a[0] = 'console.log(\'not vulnerable\')';
    const v1 = c[0];
    const v2 = eval(v1);
    return v2;
};
module.exports = f;