const f = function (x) {
    const v2 = function () {
        const v1 = eval(x);
        return v1;
    };
    return v2;
};
module.exports = f;