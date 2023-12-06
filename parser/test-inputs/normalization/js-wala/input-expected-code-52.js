const v4 = function (j) {
    var i = 0;
    let v1 = i < j;
    while (v1) {
        const v3 = i % 2;
        if (v3)
            break;
        const v2 = ++i;
        v1 = i < j;
    }
};
v4(10);