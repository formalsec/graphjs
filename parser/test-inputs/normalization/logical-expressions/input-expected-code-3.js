const v1 = 1;
let v2;
if (v1) {
    const v3 = 2;
    v2 = v3;
    if (v3) {
        const v4 = 3;
        v2 = v4;
    }
    else {
        v2 = v3;
    }
}
else {
    v2 = v1;
}