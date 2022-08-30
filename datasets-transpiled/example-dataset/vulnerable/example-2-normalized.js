const f = function (y) {
    let x = {};
    x.f = y;
    let o = x;
    const v1 = o.f;
    const v2 = eval(v1);
    return v2;
};
module.exports = f;