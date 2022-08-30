const f = function (path, value) {
    obj = {};
    var i = 0;
    const v1 = path.length;
    let v2 = i < v1;
    while (v2) {
        const key = path[i];
        const v4 = path.length;
        const v5 = v4 - 1;
        const v6 = i === v5;
        if (v6) {
            obj[key] = value;
        }
        obj = obj[key];
        const v3 = i++;
        v2 = i < v1;
    }
};
module.exports = f;