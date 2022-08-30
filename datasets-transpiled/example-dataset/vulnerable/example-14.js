// taint object property

module.exports = function f(key, subKey, value) {
    let customer = { name: { first: "person" }, role: "user" };
    customer[key][subKey] = value;
    console.log(`customer.name.first => ${customer.name.first}`);
    return customer;
};