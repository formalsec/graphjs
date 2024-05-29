// tests if injection in the caller is detected when g propagate taint to the return argument (and g is an external function)
// case where the require doesn't have the .js extension
// A single vulnerability should be reported in line 8


let g = require('./g');
function f(x){
    eval(g(x))
}

module.exports = {f};