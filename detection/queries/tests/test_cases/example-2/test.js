function f(x) {
    function g(x) {
        eval(x);
    }
    g(x)
}

module.exports = f;

// [Call(f)]