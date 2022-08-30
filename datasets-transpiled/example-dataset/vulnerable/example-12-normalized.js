const f = function (c, p) {
    let x = c[p];
    const v1 = eval(x);
    return v1;
};
module.exports = f;