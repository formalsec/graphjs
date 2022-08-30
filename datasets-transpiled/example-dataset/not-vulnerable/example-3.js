// taint object property
// sanitization before assignment

function assign(obj, key, value) {
    if (key == "__proto__" || typeof obj[key] === 'function') {
        return;
    }
    obj[key] = value;
}

module.exports = function f(key, value) {
    let customer = { name: "person", role: "user" };
    assign(customer, key, value);
    console.log(`customer.role => ${customer.role}`);
    console.log(`toString implementation => ${customer.toString()}`);
};