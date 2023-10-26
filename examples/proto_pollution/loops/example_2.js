module.exports = f;

function f(obj, path, value) {
    const dotPath = path.split(".")
    for (let i = 0; i < dotPath.length; i++) {
        const key = dotPath[i]
        if (i === dotPath.length - 1) {
            obj[key] = value
        }
        obj = obj[key]
    }
}
