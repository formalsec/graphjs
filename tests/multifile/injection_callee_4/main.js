// tests if injection in the callee is detected if callee exports the function with a different name than the one it is declared
// No vulnerabilities should be reported for this file

let g = require('./g.js');

function f(x){
    g.a(x);
}

module.exports = {f};