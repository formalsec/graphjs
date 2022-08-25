function f(x) {
    this.x = x;
    return eval(this.x);
}