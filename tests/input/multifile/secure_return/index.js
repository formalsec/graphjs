let g = require('./g.js');

function f(x){
    eval(g(x))
}

module.exports = {f};