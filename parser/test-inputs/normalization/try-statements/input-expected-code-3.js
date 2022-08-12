try {
    const v1 = f();
    v1;
} catch (e) {
    const v2 = alert(e);
    v2;
} finally {
    const v3 = alert('done');
    v3;
}