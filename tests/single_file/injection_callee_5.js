function f(x){
    let a = g(x)
    h(a)
}

function g(x){
    return x;
}

function h(x){
    eval(x)
}

module.exports = {f};