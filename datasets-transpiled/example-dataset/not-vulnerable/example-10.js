// NOT ipt, object is never accessed

module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    customer[p] = t;
};