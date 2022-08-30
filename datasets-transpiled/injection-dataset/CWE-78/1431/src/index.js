var exec = require('child_process').exec;
var parse = require('./parse');

module.exports = function df(aOptions, aCallback) {
    var options;
    var callback;

    if (typeof aOptions === 'function') {
        options = {};
        callback = aOptions;
    } else {
        options = aOptions;
        callback = aCallback;
    }

    // TODO: this should throw an error because invoking df without a callback function is pointless.
    // It's a breaking change to be made after releasing 0.1.4
    if (typeof callback !== 'function') {
        callback = function () {};
    }

    // TODO: this should invoke callback with an error
    // It's a breaking change to be made after releasing 0.1.4
    if (typeof options !== 'object') {
        options = {};
    }

    // TODO: snould validate options and merge with defaults
    // It's a breaking change to be made after releasing 0.1.4

    // TODO: should throw if prefixMultiplier is not a string
    // It should invoke callback with `err` but it's a breaking change

    // TODO: should fail if unit is not a string

    var command = 'df -kP';
    if (options.file) {
        command += ' ' + options.file;
    }

    exec(command, function (err, stdout, stderr) {
        if (err) {
            callback(err);
            return;
        }

        if (stderr) {
            callback(new Error(err));
            return;
        }

        var entries = parse(stdout, options);

        callback(null, entries);
    });
};