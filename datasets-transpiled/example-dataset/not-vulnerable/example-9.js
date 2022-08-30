// testing sanatized parameter to eval call

function sanatize(s) {
    return s;
}

module.exports = function f(x) {
    return eval(sanatize(x));
};