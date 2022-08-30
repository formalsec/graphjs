module.exports = function f(key, val) {
    let customer = { name: "person", role: "user" };
    customer[key] = val;
    customer[val] = key;
    console.log(`customer.role => ${customer.role}`);
    console.log(`toString implementation => ${customer.toString()}`);
};