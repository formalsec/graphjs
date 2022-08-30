'use strict';

var exec = require('child_process').exec;
var plist = require('simple-plist');

module.exports = function (path, callback) {
  exec('codesign -d --entitlements :- ' + path, function (error, output) {
    if (error) {
      return callback(error);
    }

    callback(null, plist.parse(output));
  });
};