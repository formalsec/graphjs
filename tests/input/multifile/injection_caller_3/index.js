// tests if injection in the caller is detected when multiple calls appear in the path and 
// one call doesn't propagte taint to the return argument
// No vulnerabilities should be reported for this file

let g = require('./g.js');
let h = require('./h.js');
function f(x){
    eval(g(h(x)))
}

module.exports = {f};