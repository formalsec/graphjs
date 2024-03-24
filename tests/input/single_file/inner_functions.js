// Checks if the injection is detected even if it is found in an inner function
// A vulnerability should be reported in line 6

function f(x){
    function innerVulnerableFunction(x){
        eval(x);
    }

    innerVulnerableFunction(x);

}

module.exports = {f};