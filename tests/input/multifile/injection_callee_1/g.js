// A vulnerabilitiy should be reported in this file in line 4

function g(x){
    eval(x);
}

module.exports = g;