// Checks if the injection is detected even if it is found in the included object's subobjects
// No vulnerabilities should be detected for this file

let g = require('./g');

function f(x){
    g.z.a.f(x);
}

module.exports = {f};