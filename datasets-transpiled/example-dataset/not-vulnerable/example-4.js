// testing taint from parameter to eval function call
// condition to call eval is never met 

module.exports = function f(x) {
    if (false) {
        eval(x);
    }
    return "not vulnerable";
};