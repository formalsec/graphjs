// tests if injection in the caller is detected when both argumetns are used in the call and both propagate taint
// A single vulnerability should be reported in line 6


function f(x,y){
    eval(g(x,y))
}


function g(x,y){
    return x +y;
}

module.exports = {f};