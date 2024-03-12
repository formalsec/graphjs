// tests if injection in the callee is detected when only f is exported
// A single vulnerability should be reported in line 9 

function f(x){
    g(x);
}

function g(x){
    eval(x);
}

module.exports = {f};