module.exports = function f(x) {
    try {
        return eval(x);
    } catch (e) {
        console.log(e);
    }
};