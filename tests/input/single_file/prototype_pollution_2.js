// direct prototype pollution but in a function
// Vulnerability should be reported for line 10
function f(x,y,z){
    g(x,y,z);
}


function g(a,b,c){
    let o = {};
    o[a][b] = c;
}

module.exports = f;