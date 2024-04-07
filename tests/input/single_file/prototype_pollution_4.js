// tests if prototype pollution is detected if the first lookup is done in the callee,
// the assignment is done in the caller
// Vulnerability should be reported for line 5
function pollute (o, x, y, z) {
    let w = lookup(o, x);
    w[y] = z;

}

function lookup(c,d) {
    return c[d];
}
module.exports = pollute;