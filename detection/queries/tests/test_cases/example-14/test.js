function f(x) {
    const g = (x) => { eval(x)}
    const h = new Promise(g)
}
module.exports = f