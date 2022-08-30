var assert = require('assert');

module.exports = setIn;

function setIn(object, path, value) {
  assert.equal(typeof object, 'object', 'setIn: expected object as first argument.');
  assert.ok(Array.isArray(path), 'setIn: expected array path as second argument.');

  return recursivelySetIn(object, path, value, 0);
}

function recursivelySetIn(object, path, value, index) {
  if (index === path.length) {
    return value;
  }

  object = object || {};

  // https://stackoverflow.com/a/60850027
  assert.ok(path[index] !== '__proto__', 'setIn: "__proto__" is disallowed in path due to possible prototype pollution attack.');
  if (index < path.length - 1) {
    assert.ok(path[index] !== 'constructor' && path[index + 1] !== 'prototype', 'setIn: ["constructor", "prototype"] is disallowed in path due to possible prototype pollution attack.');
  }

  var key = path[index];

  if (key === '-') {
    assert.ok(Array.isArray(object), 'setIn: "-" in path must correspond to array.');
    key = object.length;
  }

  if (key === '__proto__' || key === 'constructor' && path[index + 1] === 'prototype') {}

  var next = recursivelySetIn(object[key], path, value, ++index);

  return set(object, key, next);
}

function set(object, key, value) {
  object[key] = value;
  return object;
}