const f = function (key, subKey, value) {
    const v1 = { first: 'person' };
    let customer = {};
    customer.name = v1;
    customer.role = 'user';
    const v2 = customer[key];
    v2[subKey] = value;
    const v3 = console.log;
    const v4 = customer.name;
    const v5 = v4.first;
    const v6 = v3(`customer.name.first => ${v5}`);
    v6;
    return customer;
};
module.exports = f;