// ipt
// different references to parameter

module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    let x = p;
    let a = [0, 0];
    a[0] = x;
    customer[a[0]] = t;
    console.log(`customer.role => ${customer.role}`);
    console.log(`toString implementation => ${customer.toString()}`);
};