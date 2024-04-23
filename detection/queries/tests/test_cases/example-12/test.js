class F {
  g(x) {
    eval(x)
  }
}

function h() {
  return F;
}

module.exports = h;
