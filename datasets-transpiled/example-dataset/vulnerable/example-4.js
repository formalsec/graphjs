// testing sub-objects taint
// unknown property of sub-object

module.exports = function f(req) {
    const x = req.body;
    x.a = 2;
    return eval(x.param);
};