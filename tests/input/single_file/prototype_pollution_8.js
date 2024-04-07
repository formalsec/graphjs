// tests if prototype pollution is detected if the first lookup is done in a 
// function and the property assignment is done in another function, but the call chain is more complex
// Vulnerability should be reported for line 20
function main(o, x, y, z) {
    let w = lookup(o, x);
    let v = intermediate(w);
    pollute(v, y, z);

}

function intermediate(w){
    return w;
}

function lookup(c,d) {
    return c[d];
}

function pollute(w, y, z) {
    w[y] = z;
}
module.exports = main;