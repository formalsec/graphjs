const m = require("./eval");

function source(x) {
  return m.myEval(x);
}

module.exports = source;