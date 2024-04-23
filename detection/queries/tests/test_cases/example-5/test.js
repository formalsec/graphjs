function f(x) {
    function g(x) {
        eval(x);
    }
    return { prop: g };
}

module.exports = f;

// [ Call(f), MCall(g, prop) ]