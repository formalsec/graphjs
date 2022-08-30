
// Should be used *before* connect.static

module.exports = function (docroot, phpBin) {
  'use strict';

  phpBin = phpBin || 'php';

  var fs = require('fs');

  var join = require('path').join;

  var norm = require('path').normalize;

  return function (req, res, next) {
    if (/\.php$/i.test(req.url)) {
      var phpFile = norm(join(docroot, req.url));
      fs.exists(phpFile, function (exists) {
        if (exists) {
          res.setHeader('Content-Type', 'text/html');

          var cp = require('child_process').spawn(phpBin, [phpFile]);

          cp.stdout.on('data', function (data) {
            res.write(data);
          });

          cp.stderr.on('data', function (data) {
            res.write(data);
          });

          cp.on('close', function () {
            res.end('');
          });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  };
};