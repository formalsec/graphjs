function f(x, y) {
    this.options = x;
    const self = this;
    f.prototype.func = function(cb) {
        eval(self.options);
    }
}