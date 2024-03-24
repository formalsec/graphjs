// tests if injection in the caller is detected when the sink is in the middle of the call chain
// A single vulnerability should be reported in line 10


function f(x){
    g(x);
}

function g(x){
    eval(h(x))
}

function h(x){
    return x;
}


module.exports = {f, g,h};