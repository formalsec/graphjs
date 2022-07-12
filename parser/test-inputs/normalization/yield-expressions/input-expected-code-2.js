const foo = function* (index) {
    const v1 = index++;
    yield v1;
};