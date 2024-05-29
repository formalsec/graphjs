// tests if prototype pollution is detected if the first lookup is
// done in the called and that object is used as the argument in called function where the assignment is made
// Vulnerability should be reported for line 14
function pollute (o, x, y, z) {
    var w = o[x];
    intermediate(w, y, z);
}

function intermediate(w, y, z) {
    last_step_pollution(w, y, z);
}

function last_step_pollution(w, y, z) {
    w[y] = z;
}

module.exports = pollute;