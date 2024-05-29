// tests if prototype pollution chain is corectly followed
// no pollution should be detected

function pollute (o, x, y, z) {
    var w = o[x];
    let o = {};
    last_step_pollution(w, y, z,o);
}


function last_step_pollution(w, y, z,o) {
    o[y] = z;
}

module.exports = pollute;