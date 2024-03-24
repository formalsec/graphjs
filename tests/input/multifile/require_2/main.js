//   -> e -> h
// a       
//   -> f -> h

// this example is mainly to see if h's graph doesn't appear twice in the final graph
// if it does, then the graph is not being merged correctly
// Should only report a vulnearbiltiy in file h.js (should not be repeated)

let e = require('./e.js');
let f = require('./f.js');


function a(x){
    e(x);

    f(x);
}

module.exports = a;