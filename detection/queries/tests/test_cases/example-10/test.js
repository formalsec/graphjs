function F() {
}

F.prototype.g = function g (x) {
  eval(x)
}

module.exports = F;