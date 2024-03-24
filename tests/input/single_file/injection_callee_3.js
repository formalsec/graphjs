// tests if injection in the callee is detected if the injection occurs later in the call chain
// A single vulnerability should be reported in line 13

function f(x){
    g(x);
}

function g(x){
    h(x);
}

function h(x){
    eval(x);
}

module.exports = {f};