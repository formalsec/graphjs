const v2 = function (i) {
    const v1 = i++;
    return v1, 42;
};
v2();