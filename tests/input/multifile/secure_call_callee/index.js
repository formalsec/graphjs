// tests if no vulnerabilities are reported when the call to the callee is secure and the callee is in an external file
// no vulnerabilities should be reported

let g = require('./g.js');

function f(x){
    g("sda")
}

module.exports = {f};