const sink = require("shelljs").exec

function f(obj, key, sub_key, value) {
    const sub_obj = obj[key]
    sub_obj[sub_key] = value
    sub_obj.some_prop = 'not tainted'
    sink(sub_obj.other_prop)
}

module.exports = f