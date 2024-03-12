// tests if no vulnerabilities are reported when the call to the callee is secure
// no vulnerabilities should be reported

function f(x){
    g("asd");
}

function g(x){
    eval(x);
}

module.exports = {f};