// testing taint from parameter to eval function call
// eval is a local function

function eval(x) {
    return x;
}

module.exports = function f(x) {
    return eval(x);
};