// tests if prototype pollution is detected if the lookups returned by a function and the property assignment is done in another function
// this has longer call chains that number 4
// Vulnerability should be reported for line 14
function pollute (o, x, y, z) {
    let w = intermediate(o, x);
    w[y] = z;

}

function intermediate(c,d){
    return lookup(c,d);
}
function lookup(c,d) {
    return c[d];
}
module.exports = pollute;