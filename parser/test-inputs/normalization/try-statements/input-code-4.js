function f(x) {
    try {
        f();
    } catch (e) {
        eval(x[e["someValue"]])
    } finally {
        alert('done')
    }
}