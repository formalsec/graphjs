function f(x) {
    const g = (x) => { eval(x)}
    return new Promise(g)
}
module.exports = f