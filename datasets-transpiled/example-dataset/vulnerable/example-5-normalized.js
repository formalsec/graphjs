const read = require('./aux-files/external-read');
const f = function () {
    const s = read();
    const v1 = eval(s);
    return v1;
};
module.exports = f;