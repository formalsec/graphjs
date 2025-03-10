// tests if injection in the caller is detected when multiple calls appear in the path and all propagtes taint to the return argument
// A single vulnerability should be reported in line 7

let g = require('./g.js');
let h = require('./h.js');
function f(x){
    eval(g(h(x)))
}

module.exports = {f};