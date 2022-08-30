// taint object property

module.exports = function f(key, subKey, subSubKey, subSubSubKey, value) {
    let customer = { name: { first: { letter: { morse: ".__." } } }, role: "user" };
    customer[key][subKey][subSubKey][subSubSubKey] = value;
    console.log(`customer.name.first.letter.morse => ${customer.name.first.letter.morse}`);
    console.log(`toString implementation => ${customer.name.first.letter.toString()}`);
    return customer;
};