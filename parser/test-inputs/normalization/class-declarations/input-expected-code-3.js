const Foo = function Foo() {
    const v1 = super();
    v1;
};
const foo = function foo() {
    const v2 = 1 + 2;
    v2;
};
Foo.foo = foo;