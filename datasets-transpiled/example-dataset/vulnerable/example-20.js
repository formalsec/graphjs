// ipt

module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    let obj = { p1: "p1", p2: "p2" };
    customer[p] = t;
    let x = customer;
    x[t] = p;
    x.role;
    x.p2;
    obj[p] = t;
    obj.p1;
    obj[t] = p;
    return customer;
};