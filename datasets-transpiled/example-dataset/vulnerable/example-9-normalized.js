const f = function (source1, source2) {
    const Func = function () {};
    ;
    const v1 = Func.prototype;
    v1.x = '2';
    const myFunc = new Func();
    if (source1) {
        const v2 = myFunc.x;
        const v3 = v2 + source1;
        myFunc[source2] = v3;
    }
    const v4 = myFunc.x;
    const v5 = eval(v4);
    return v5;
};
module.exports = f;