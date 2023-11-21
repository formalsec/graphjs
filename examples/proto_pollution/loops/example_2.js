module.exports = f;

function f(obj, dotPath, value) {
    const path = dotPath.split(".")
    for (let i = 0; i < path.length; i++) {
        const key = path[i]
        if (i === path.length - 1) {
            obj[key] = value
        }
        obj = obj[key]
    }
}
