// tests if prototype pollution is detected if the property assignment is done in a function
// Vulnerability should be reported for line 9
function pollute (o, x, y, z) {
    var w = o[x];
    last_step_pollution(w, y, z);
}

function last_step_pollution(w, y, z) {
    w[y] = z;
}

module.exports = pollute;