// tests if injection in the callee is detected if return value is passed to another function
// A single vulnerability should be reported in line 13

function f(x){
    h(g(x));
}

function g(x){
    return x;
}

function h(x){
    eval(x);
}

module.exports = {f};