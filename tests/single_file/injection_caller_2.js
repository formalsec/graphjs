// tests if injection in the caller is detected when g and h propagate taint to the return argument
// A single vulnerability should be reported in line 5

function f(x){
    eval(g(x))
}

function g(x){
    return h(x);
}

function h(x){
    return x;
}

module.exports = {f, g,h};