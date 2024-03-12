// tests if injection in the caller is detected when multiple calls appear in the path and 
// all calls propagte taint to the return argument (simular to injection_caller_4.js but return of the first 
// call is stored in a variable before being passed to the second call)
// A single vulnerability should be reported in line 8

function f(x){
    let a = h(x);
    eval(g(a))
}

function g(x){
    return x;
}

function h(x){
    return x;
}


module.exports = {f, g,h};