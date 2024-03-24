// tests if injection in the caller is detected when multiple calls appear in the path and 
// one call doesn't propagte taint to the return argument
// No vulnerabilities should be reported for this file

function f(x){
   eval(g(h(x)))
}

function g(x){
    return 0;
}

function h(x){
    return x;
}


module.exports = {f, g,h};