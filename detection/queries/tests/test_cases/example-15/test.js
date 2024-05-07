function f(x) {
    const g = (x) => { eval(x)}
    const h = new Promise(g)
}
exports.f = f