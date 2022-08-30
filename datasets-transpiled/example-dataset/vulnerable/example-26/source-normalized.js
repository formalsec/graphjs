const sink = require('./sink.js');
const f = function (x) {
    const v1 = sink(x);
    return v1;
};
module.exports = f;