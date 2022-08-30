const f = function (x) {
    this.input = x;
    const v3 = function () {
        const v1 = this.input;
        const v2 = eval(v1);
        return v2;
    };
    return v3;
};
module.exports = f;