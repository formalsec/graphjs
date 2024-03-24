// A vulnerabilitiy should be reported in this file in line 5

let h = require('./h.js');
function g(x){
    eval(h(x));
}

module.exports = {g};