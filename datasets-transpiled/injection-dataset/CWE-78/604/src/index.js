var cp = require('child_process');

module.exports = function whereis(name, cb) {
  cp.exec('which ' + name, function (error, stdout, stderr) {
    stdout = stdout.split('\n')[0];
    if (error || stderr || stdout === '' || stdout.charAt(0) !== '/') {
      stdout = stdout.split('\n')[0];
      cp.exec('whereis ' + name, function (error, stdout, stderr) {
        if (error || stderr || stdout === '' || stdout.indexOf('/') === -1) {
          cp.exec('where ' + name, function (error, stdout, stderr) {
            //windows
            if (error || stderr || stdout === '' || stdout.indexOf('\\') === -1) {
              cp.exec('for %i in (' + name + '.exe) do @echo. %~$PATH:i', function (error, stdout, stderr) {
                //windows xp
                if (error || stderr || stdout === '' || stdout.indexOf('\\') === -1) {
                  return cb(new Error('Could not find ' + name + ' on your system'));
                }
                return cb(null, stdout);
              });
            } else {
              return cb(null, stdout);
            }
          });
        } else {
          return cb(null, stdout.split(' ')[1]);
        }
      });
    } else {
      return cb(null, stdout);
    }
  });
};