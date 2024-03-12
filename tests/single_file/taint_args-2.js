// tests if the taint edges are correctly connected to the attacker controlled parameters
// A single vulnerability should be reported in line 5

function g(x){
    eval(x);
}

module.exports = {g};