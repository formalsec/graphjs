// A vulnerabilitiy should be reported for this file in line 4

function g(x){
   eval(x);
}

module.exports = {a:g};