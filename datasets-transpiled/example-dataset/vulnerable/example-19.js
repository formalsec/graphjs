// ipt, returns tampered object

module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    customer[p] = t;
    return customer;
};