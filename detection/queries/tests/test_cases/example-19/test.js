const async = require('async');

function callback(a) {
    console.log(a)
}
function f(a) {
    async.queue(function (a, b) {
        eval(a)
    }, callback);
}

module.exports = f