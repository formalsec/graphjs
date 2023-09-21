const f = function (o) {
    const v1 = o.z;
    const v2 = v1 > 0;
    if (v2) {
        o.y = '2';
        const v3 = o.y;
        const v4 = o.w;
        const v5 = v3 + v4;
        const v6 = eval(v5);
        return v6;
    }
};
module.exports = f;