// tests if injection in the caller is detected when h and i propagates taint, but g does not
// A single vulnerability should be reported in line 7, since the both h and i propagate taint to the return argument.
// but g does not, so no vulnerability should be reported in line 6

function f(x){
    eval(g(x))
    eval(h(x))
}

function g(x){
    let a =  i(x);
    return 0;
}

function h(x){
    return x;
}

function i(x){
    return x;
}

module.exports = {f, g,h,i};