function f(x) {
    some_call.then(function(y) {
        eval(x + y)
    })
}

module.exports = f