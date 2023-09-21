const v29 = function (key, value) {
    const v2 = this.readOnly;
    if (v2) {
        return false;
    }
    var target = this.store;
    const v3 = this.logicalSeparator;
    const v4 = common.path;
    var path = v4(key, v3);
    const v5 = path.length;
    const v6 = v5 === 0;
    if (v6) {
        const v7 = !value;
        const v8 = typeof value;
        const v9 = v8 !== 'object';
        const v10 = v7 || v9;
        if (v10) {
            return false;
        } else {
            const v11 = this.reset;
            const v12 = v11();
            v12;
            this.store = value;
            return true;
        }
    }
    const v14 = Date.now;
    const v15 = v14();
    v13[key] = v15;
    const v16 = path.length;
    let v17 = v16 > 1;
    while (v17) {
        const v18 = path.shift;
        key = v18();
        const v19 = target[key];
        const v20 = !v19;
        const v21 = target[key];
        const v22 = typeof v21;
        const v23 = v22 !== 'object';
        const v24 = v20 || v23;
        if (v24) {
            target[key] = {};
        }
        target = target[key];
        v17 = v16 > 1;
    }
    const v25 = path.shift;
    key = v25();
    const v26 = this.parseValues;
    if (v26) {
        const v27 = common.parseValues;
        const v28 = v27.call;
        value = v28(common, value);
    }
    target[key] = value;
    return true;
};
v1.set = v29;