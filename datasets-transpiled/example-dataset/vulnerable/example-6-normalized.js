const read = function () {
    return '2+2';
};
const f = function () {
    const s = read();
    const v1 = eval(s);
    return v1;
};
module.exports = f;