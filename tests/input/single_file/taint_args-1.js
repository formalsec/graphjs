// tests if the taint edges are correctly connected to the attacker controlled parameters
// no vulnerabilities should be reported

function f(x,y){
    console.log(x);
    console.log(y);
}

function g(x){
    eval(x);
}

module.exports = {f};