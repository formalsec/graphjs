// testing input from other function not in scope (using require)

const read = require("./aux-files/external-read");

module.exports = function f() {
    const s = read();
    return eval(s);
};