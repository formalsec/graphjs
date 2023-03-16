const f = async function (x) {
    const v1 = x.f;
    let a = await v1();
    const v2 = eval(a);
    v2;
};