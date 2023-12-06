const f = function (x) {
    try {
        const v1 = f();
        v1;
    } catch (e) {
        const v2 = e['someValue'];
        const v3 = x[v2];
        const v4 = eval(v3);
        v4;
    } finally {
        const v5 = alert('done');
        v5;
    }
};