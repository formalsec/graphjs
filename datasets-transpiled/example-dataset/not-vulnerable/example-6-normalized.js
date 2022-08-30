const f = function (x) {
    obj = {};
    obj.a = 'console.log("not vulnerable")';
    obj.v = x;
    const v1 = obj.a;
    const v2 = eval(v1);
    return v2;
};
module.exports = f;