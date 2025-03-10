// tests if injection in the caller is detected when g propagate taint to the return argument (and g is an external function)
// A single vulnerability should be reported in line 7


let g = require('./g.js');
function f(x){
    eval(g(x))
}

module.exports = {f};