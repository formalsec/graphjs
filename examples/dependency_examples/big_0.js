function f(o) {
    if (o.z > 0) {
        o.y = 2;
        eval(o.y + o.w);
    }
    o.y = o.w;
    eval(o.y);
}