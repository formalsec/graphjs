const f = function (x) {
    try {
        const v1 = eval(x);
        return v1;
    } catch (e) {
        const v2 = console.log;
        const v3 = v2(e);
        v3;
    }
};
module.exports = f;