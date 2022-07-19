const p = "xx";
const a = [0];
const c = a;
a[0] = p;
eval(c[0]);