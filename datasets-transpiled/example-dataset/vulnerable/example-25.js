const child_process = require('child_process');

module.exports = function f(x) {
    child_process.exec(x);
};