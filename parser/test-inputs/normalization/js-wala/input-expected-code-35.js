var i = 0;
let v1 = i < 10;
while (v1) {
    alert(i);
    const v2 = ++i;
    v1 = i < 10;
}