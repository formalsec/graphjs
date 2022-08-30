// testing input from other function in scope (local func)

function read() {
    return "2+2";
}

module.exports = function f() {
    const s = read();
    return eval(s);
};