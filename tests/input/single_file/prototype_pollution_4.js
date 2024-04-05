// tests if prototype pollution is detected if the lookups are done in a function and the property assignment is done in another function
// Vulnerability should be reported for line 10
function pollute (o, x, y, z) {
    let w = lookup(o, x);
    w[y] = z;

}

function lookup(c,d) {
    return c[d];
}
module.exports = pollute;