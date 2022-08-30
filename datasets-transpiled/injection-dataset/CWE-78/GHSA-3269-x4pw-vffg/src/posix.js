'use strict';

var exec = require('child_process').exec;
var isDigits = require('./utils').isDigits;

function diskusage(path, cb) {
    if (path.indexOf('"') !== -1) {
        return cb(new Error('Paths with double quotes are not supported yet'));
    }

    exec('df -k "' + path + '"', function (err, stdout) {
        if (err) {
            return cb(err);
        }

        try {
            cb(null, parse(stdout));
        } catch (e) {
            cb(e);
        }
    });
}

function parse(dusage) {
    var lines = dusage.split('\n');
    if (!lines[1]) {
        throw new Error('Unexpected df output: [' + dusage + ']');
    }
    var parts = lines[1].split(' ').filter(function (x) {
        return x !== '';
    });
    var total = parts[1];
    var used = parts[2];
    var available = parts[3];
    if (!(isDigits(total) && isDigits(used) && isDigits(available))) {
        throw new Error('Unexpected df output: [' + dusage + ']');
    }

    return {
        total: total * 1024,
        used: used * 1024,
        available: available * 1024
    };
}

module.exports = {
    diskusage: diskusage,
    parse: parse
};