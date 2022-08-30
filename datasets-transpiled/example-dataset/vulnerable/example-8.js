module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    customer[p] = t;
    console.log(`customer.role => ${customer.role}`);
    console.log(`toString implementation => ${customer.toString()}`);
};