function f (x) {
  function g(x) {
    eval(x)
  }
  return g;
}

module.exports = { prop: f };