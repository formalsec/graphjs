let v = class Foo extends Bar {
    constructor() {
        const v1 = super();
        v1;
    }
    foo() {
        const v2 = 1 + 2;
        v2;
    }
};