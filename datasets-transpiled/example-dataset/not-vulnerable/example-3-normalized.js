const assign = function (obj, key, value) {
    const v1 = key == '__proto__';
    const v2 = obj[key];
    const v3 = typeof v2;
    const v4 = v3 === 'function';
    const v5 = v1 || v4;
    if (v5) {
        return;
    }
    obj[key] = value;
};
const f = function (key, value) {
    let customer = {};
    customer.name = 'person';
    customer.role = 'user';
    const v6 = assign(customer, key, value);
    v6;
    const v7 = console.log;
    const v8 = customer.role;
    const v9 = v7(`customer.role => ${v8}`);
    v9;
    const v10 = console.log;
    const v11 = customer.toString;
    const v12 = v11();
    const v13 = v10(`toString implementation => ${v12}`);
    v13;
};
module.exports = f;