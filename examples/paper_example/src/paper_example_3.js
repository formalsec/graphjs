var exec = require('child_process').exec
module.exports = f;

function f(key, value) {
    const a = {}
    a[key] = value
    a.b = "banana"
    exec(a.p);
}

