// tests if prototype pollution is detected if the first lookup is done in a 
// function and the property assignment is done in another function
// Vulnerability should be reported for line 15
function main(o, x, y, z) {
    let w = lookup(o, x);
    pollute(w, y, z);

}

function lookup(c,d) {
    return c[d];
}

function pollute(w, y, z) {
    w[y] = z;
}
module.exports = main;