const v1 = 1 + 2;
const v2 = 1 + 2;
const v3 = eval('1 + 2', v2);
[
    [
        [],
        v1
    ],
    v3
];

const v1 = 1 + 2;
const v2 = [
    [],
    v1
];
const v3 = '1' + 2;
const v4 = 1 + 2;
const v5 = eval(v3, v4);
[
    v2,
    v5
];
