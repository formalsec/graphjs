const extend = function (dest, src) {
    let p;
    for (p in src) {
        dest[p] = src[p];
    }
};