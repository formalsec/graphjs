const f = function (y) {
    let x = {};
    x.f = y;
    const v1 = x.f;
    const v2 = eval(v1);
    return v2;
};
module.exports = f;