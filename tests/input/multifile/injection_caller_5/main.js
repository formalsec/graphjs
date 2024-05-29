// tests if injection in the caller is detected when multiple calls appear in the path and all propagtes taint to the return argument
// call is stored in a variable before being passed to the second call)
// A single vulnerability should be reported in line 9

let g = require('./g.js');
let h = require('./h.js');
function f(x){
    let a = h(x);
    eval(g(a))
}

module.exports = {f};