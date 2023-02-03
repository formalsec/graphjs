function f(o) {
    const x = o.x;
    if (x) {
        o.y = "2";
    } else {
        o.w = "3";
    }

    const y = o.y;
    eval(o.x);
}