const child_process = require('child_process');
const f = function (x) {
    const v1 = child_process.exec;
    const v2 = v1(x);
    v2;
};
module.exports = f;