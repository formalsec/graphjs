const f = function (x) {
    const c = eval;
    const v1 = c(x);
    return v1;
};
module.exports = f;