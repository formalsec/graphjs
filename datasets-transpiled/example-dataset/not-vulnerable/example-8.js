module.exports = function f(key, value) {
    let customer = { name: "person", role: "user" };
    let customerBak = JSON.parse(JSON.stringify(customer));
    customer[key] = value;
    customer = customerBak;
    console.log(`customer.role => ${customer.role}`);
    console.log(`toString implementation => ${customer.toString()}`);
};