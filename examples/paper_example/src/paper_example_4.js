var exec = require('child_process').exec
module.exports = f;

function f(key, value) {
    const obj = {}
    obj[key] = value
    obj.b = "banana"
    exec(obj.p);
    obj.p = value
    exec(obj.p)
}