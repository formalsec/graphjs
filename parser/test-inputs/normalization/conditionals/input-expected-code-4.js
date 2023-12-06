const v1 = format('Wmic reported the following error: %s.', stderr);
let v2;
if (stderr) {
    v2 = v1;
} else {
    v2 = 'Wmic reported no errors (stderr empty).';
}
stderr = error + v2;