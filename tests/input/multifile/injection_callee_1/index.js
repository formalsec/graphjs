// tests if injection in the callee is detected when f is exported and the vulnerability is in the included file
// No vulnerabilities should be reported for this file

let g = require('./g.js');

function f(x){
    g(x);
}

module.exports = {f};