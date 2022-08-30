const f = function (x) {
    this.input = x;
    const y = function () {
        let self = this;
        const v1 = self.input;
        const v2 = eval(v1);
        v2;
    };
};