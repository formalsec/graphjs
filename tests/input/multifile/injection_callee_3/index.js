// tests if injection in the callee is detected if return value is passed to another function
// No vulnerabilities should be reported for this file

let g = require('./g.js');
let h = require('./h.js');

function f(x){
    h(g(x));
}

module.exports = {f};