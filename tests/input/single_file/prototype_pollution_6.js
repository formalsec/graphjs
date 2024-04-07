// tests if prototype pollution is detected if the property assignment is done in called function 
// and the lookup is used as the argument
// further down the call chain
// Vulnerability should be reported for line 15
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