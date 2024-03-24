// tests if injection in the callee is detected when f is exported and the vulnerability is in the further down the call chain
// The vulnerability will no be reported in this file, but further down the inclusion chain
// No vulnerabilities should be reported for this file

let g = require('./g.js');

function f(x){
    g(x);
}

module.exports = {f};