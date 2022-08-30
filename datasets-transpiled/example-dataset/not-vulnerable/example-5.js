// testing taint from parameter to eval function call
// condition to call eval is never met 

module.exports = function f(x) {
    if (isNaN(x)) return "not vulnerable (NaN)";

    if (x >= 0) {
        return "not vulnerable (>= 0)";
    } else if (x < 0) {
        return "not vulnerable (< 0)";
    } else {
        return eval(x);
    }
};