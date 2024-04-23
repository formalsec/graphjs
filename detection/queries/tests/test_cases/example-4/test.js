function f(x) {
    function g(x) {
        function h(x) {
            eval(x);
        }
        return h;
    }
    return g;
}

module.exports = f;

// [ Call(f), Call(g), Call(h) ]