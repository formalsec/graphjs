/// tests if injection in the caller is detected when the sink is in the middle of the call chain
// No vulnerabilities should be reported for this file

let g = require('./g.js');
function f(x){
    g(x);
}

module.exports = {f};