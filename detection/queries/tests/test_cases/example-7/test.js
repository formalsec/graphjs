function f(x) {
  function g(x) {
    function h(x) {
      eval(x)
    }
    return { croc: h };
  }
  return { prop: g };
}

module.exports = f;