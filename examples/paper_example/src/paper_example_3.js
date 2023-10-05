var exec = require('child_process').exec
module.exports = f;

function f(obj, key, value) {
    obj[key] = value
    obj.b = "banana"
    exec(obj.p);
}

