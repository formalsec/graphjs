const f = function (key, val) {
    let customer = {};
    customer.name = 'person';
    customer.role = 'user';
    customer[key] = val;
    customer[val] = key;
    const v1 = customer.prop;
    v1;
};
module.exports = f;