const f = function (p, t) {
    let customer = {};
    customer.name = 'person';
    customer.role = 'user';
    customer[p] = 'literal';
    let x = t;
    customer['name'] = x;
    const v1 = customer.name;
    v1;
    return customer;
};
module.exports = f;