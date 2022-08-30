'use strict';

var exec = require('child_process').exec;
var Path = require('path');
var utils = require('./utils');

function diskusage(path, cb) {
    exec('WMIC LOGICALDISK GET Name,Size,FreeSpace', function (err, stdout) {
        if (err) {
            return cb(err);
        }

        try {
            cb(null, parse(stdout, diskname(path)));
        } catch (e) {
            cb(e);
        }
    });
}

function parse(dusage, disk) {
    var lines = dusage.replace(/\r\n/g, '\n').split('\n').filter(function (line) {
        return line.replace(/\s+/g, '').length > 0;
    });
    if (lines.length <= 1) {
        throw new Error('Unexpected WMIC output: [' + dusage + ']');
    }

    var disks = lines.splice(1).map(function (line) {
        var parts = line.split(' ').filter(function (x) {
            return x !== '';
        });

        var dname;
        var free = '0';
        var total = '0';
        if (isDiskname(parts[0])) {
            dname = parts[0];
        } else {
            free = parts[0];
            dname = parts[1];
            total = parts[2];
        }

        if (!(isDiskname(dname) && utils.isDigits(free) && utils.isDigits(total))) {
            throw new Error('Unexpected WMIC output [' + dusage + ']');
        }

        return {
            disk: dname,
            total: +total,
            available: +free
        };
    }).reduce(function (acc, c) {
        acc[c.disk] = c;
        return acc;
    }, {});

    var result = disks[disk];
    if (!result) {
        throw new Error('Unknown disk [' + disk + ']');
    }

    return {
        total: result.total,
        used: result.total - result.available,
        available: result.available
    };
}

function diskname(path) {
    var parsed = Path.parse(Path.normalize(path));
    var disk = parsed.root.split('\\')[0];
    if (!isDiskname(disk)) {
        throw new Error('Bad path');
    }
    return disk;
}

function isDiskname(s) {
    var lastCharIdx = s.length - 1;
    return typeof s === 'string' && s[lastCharIdx] === ':' && utils.isCapitals(s.substr(0, lastCharIdx));
}

module.exports = {
    diskusage: diskusage,
    parse: parse
};