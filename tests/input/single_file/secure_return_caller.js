// tests if no vulnerabilities are reported when the call to the callee is secure
// no vulnerabilities should be reported

function f(x){
    eval(g(x));
}

function g(x){
    return 0;
}

module.exports = {f};