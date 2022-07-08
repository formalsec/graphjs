function f() {
    const v1 = this.g;
    const v2 = v1();
    return v2;
}