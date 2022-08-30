const f = function (req) {
    const x = req.body;
    x.a = 2;
    const v1 = x.param;
    const v2 = eval(v1);
    return v2;
};
module.exports = f;