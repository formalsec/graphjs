const f = function (x) {
    const v1 = x.split;
    const v2 = v1(' ');
    const evalArgs = true ? x : v2;
    const v3 = eval(evalArgs);
    v3;
};
module.exports = f;