function search(opts) {
    let v1 = opts.filter;
    let v2 = !v1;
    let v3 = opts.collection;
    let v4 = v2 && v3;
    if (v4) {
        let v5 = opts.collection;
        let v6 = '...' + v5;
        opts.filter = v6;
    }
    let v7 = opts.filter;
    let v8 = eval(v7);
    v8;
}