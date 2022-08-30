// testing taint from parameter to eval function call
// using switch statement

module.exports = function f(e, x) {
    switch (e) {
        case 1:
            return eval(x);
        default:
            break;
    }
};