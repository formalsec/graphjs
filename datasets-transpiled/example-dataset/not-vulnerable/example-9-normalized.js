const sanatize = function (s) {
    return s;
};
const f = function (x) {
    const v1 = sanatize(x);
    const v2 = eval(v1);
    return v2;
};
module.exports = f;