// odgen prototype tampering example

module.exports = function f(source1, source2) {
    function Func() {};
    Func.prototype.x = "2";
    const myFunc = new Func();
    if (source1) myFunc[source2] = myFunc.x + source1; // internal property tampering
    return eval(myFunc.x); // taint - style vulnerability like command injection
};