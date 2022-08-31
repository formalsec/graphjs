function f(a, b) {
    return function(p) {
        a[p] = b[p];
    };
}