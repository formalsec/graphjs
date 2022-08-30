const f = function (p, t) {
    let customer = {};
    customer.name = 'person';
    customer.role = 'user';
    customer[p] = t;
    return customer;
};
module.exports = f;