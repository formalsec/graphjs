async function f(x) {
    let a = await x.f();
    eval(a)
}