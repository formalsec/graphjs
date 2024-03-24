// tests if injection in the caller is detected when multiple calls appear in the path and all propagtes taint to the return argument
// A single vulnerability should be reported in line 5

function f(x){
   eval(g(h(x)))
}

function g(x){
    return x;
}

function h(x){
    return x;
}


module.exports = {f, g,h};