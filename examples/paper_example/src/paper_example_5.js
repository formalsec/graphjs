var exec = require('child_process').exec

function f(value) {
    const obj = {}
    obj.p = value
    obj.b = "banana"
    exec(obj.p);
}
 module.exports = f
