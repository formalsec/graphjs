function f(object1, object2) {
  for (var key in object2) {
    if (typeof object1[key] === 'object' && typeof object2[key] === 'object') {
      // deep merge object2 into object1
      object1[key] = f(object1[key], object2[key]);
    } else {
      object1[key] = object2[key];
    }
  }
  return object1;
};

// console.log({}.oops)
// a = JSON.parse('{"__proto__": {"oops": "Polluted!"}}')
// b = JSON.parse('{"__proto__": {"oops": "Polluted!"}}')
// f({}, a) 
// console.log({}.oops)
