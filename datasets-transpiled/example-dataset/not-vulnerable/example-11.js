// NOT ipt, value is not assigned to an object or assigned value is not a source 

module.exports = function f(p, t) {
    let customer = { name: "person", role: "user" };
    customer[p] = "literal";
    let x = t;
    customer["name"] = x;
    customer.name;
    return customer;
};