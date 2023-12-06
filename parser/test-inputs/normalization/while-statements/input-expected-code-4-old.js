let x = 0;
const v1 = x < 1;
do {
    const v2 = x++;
    v2;
    break;
} while (v1);