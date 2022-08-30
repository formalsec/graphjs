// testing taint from property in parameter object (unknown)
// and using conditionals

module.exports = function f(o) {
    if (o.z > 0) {
        o.y = "2";
        return eval(o.y + o.w);
    }
};