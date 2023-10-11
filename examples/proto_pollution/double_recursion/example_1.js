var isPrimitive = require('is-primitive');
var assignSymbols = require('assign-symbols');
var typeOf = require('kind-of');

function assign(target/*, objects*/) {
    target = target || {};
    var len = arguments.length, i = 0;
    if (len === 1) {
        return target;
    }
    while (++i < len) {
        var val = arguments[i];
        extend(target, val);
    }
    return target;
}


function extend(target, obj) {
    for (var key in obj) {
        var val = obj[key];
        if (isObject(val)) {
            target[key] = assign(target[key] || {}, val);
        } else {
            target[key] = val;
            }
    }
    return target;
}