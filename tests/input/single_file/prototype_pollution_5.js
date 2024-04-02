// direct prototype pollution but in a function further down the call chain
// Vulnerability should be reported for line 14
function f(x,y,z){
    g(x,y,z);
}

function g(a,b,c){
    h(a,b,c);
}


function h(d,e,i){
    let o = {};
    o[d][e] = i;
}

module.exports = f;