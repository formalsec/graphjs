const f = function (x) {
    if (false) {
        const v1 = eval(x);
        v1;
    }
    return 'not vulnerable';
};
module.exports = f;