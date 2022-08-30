const sink = require('./sink.js');

module.exports = function f(x) {
    return sink(x);
};