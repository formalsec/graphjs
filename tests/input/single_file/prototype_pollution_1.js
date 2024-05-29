// direct prototype pollution
// Vulnerability should be reported for line 4
function f(o,x,y,z){
    o[x][y] = z;
}

module.exports = f;