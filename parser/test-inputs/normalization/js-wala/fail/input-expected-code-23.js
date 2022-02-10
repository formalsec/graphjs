({
    x: 23,
    get y() {
        const v1 = this;
        const v2 = v1.x;
        return v2;
    },
    set y(v) {}
});