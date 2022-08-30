module.exports = function f(x) {
    obj = {
        a: "console.log(\"not vulnerable\")",
        v: x
    };
    return eval(obj.a);
};