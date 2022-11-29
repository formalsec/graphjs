module.exports = function f(key, subKey, value) {
    let customer = { name: {first:"person"}, role: "user" };
    if (key != "__proto__") customer[key][subKey] = value;
}