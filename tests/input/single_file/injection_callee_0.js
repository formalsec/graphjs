// tests if injection in the callee is detected when both functions are exported and no repeated vulnerabilities are reported
// A single vulnerability should be reported in line 9

function g(x){
    eval(x);
}

module.exports = {g};