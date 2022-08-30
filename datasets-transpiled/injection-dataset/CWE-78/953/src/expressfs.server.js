var fs = require('fs'),
    exec = require('child_process').exec,
    async = require('async'),
    Path = require('path'),
    dirtospace = require('dirtospace'),
    mkdirp = require('mkdirp'),
    _ = require('underscore');

module.exports = function (app, options) {

  options = options || {};
  var prefix = options.prefix || '/';

  app.post(prefix + 'expressfs.appendFile', function (req, res, next) {
    var path = req.body.path;
    var encoding = 'utf8';
    if (req.body.encoding) encoding = req.body.encoding;
    fs.appendFile(path, req.body.content, encoding, function (err) {
      if (err) return res.send(err);
      if (req.body.redirect) return res.redirect(req.body.redirect);
      res.send('');
    });
  });

  app.post(prefix + 'expressfs.cp', function (req, res, next) {

    var source = req.body.source;
    var destination = req.body.destination;
    exec('cp -R ' + source + ' ' + destination, function () {
      res.send('');
    });
  });

  /**
   * Create a file ONLY if it does not already exist
   */
  app.post(prefix + 'expressfs.create', function (req, res, next) {
    var path = req.body.path;
    fs.exists(path, function (exists) {
      if (exists) return res.send(path + ' already exists');
      fs.writeFile(path, req.body.content || '', 'utf8', function (err) {
        if (err) return res.send(err);
        res.send('');
      });
    });
  });

  var createUntitled = function (path, i, extension, content, callback) {
    var suffix = i || '';
    var filename = path + 'untitled' + suffix + '.' + extension;
    fs.exists(filename, function (exists) {
      if (exists) return createUntitled(path, i + 1, extension, content, callback);
      fs.writeFile(filename, content, 'utf8', function (err) {
        if (err) callback(err);else callback(null, 'untitled' + suffix + '.' + extension);
      });
    });
  };

  var createUntitledDir = function (path, i, callback) {
    var suffix = i || '';
    var filename = path + 'untitled' + suffix;
    fs.exists(filename, function (exists) {
      if (exists) return createUntitledDir(path, i + 1, callback);
      mkdirp(filename, function (err) {
        if (err) callback(err);else callback(null, 'untitled' + suffix);
      });
    });
  };

  /**
   * Create a file and return it's name
   */
  app.post(prefix + 'expressfs.createUntitled', function (req, res, next) {
    var path = req.body.path.replace(/\/$/, '') + '/';
    var extension = req.body.extension;
    var content = '';
    if (req.body.content) content = req.body.content;
    createUntitled(path, 0, extension, content, function (err, filename) {
      res.set('Content-Type', 'text/plain');
      return res.send(filename);
    });
  });

  /**
   * Create a file and return it's name
   */
  app.post(prefix + 'expressfs.createUntitledDir', function (req, res, next) {
    var path = req.body.path.replace(/\/$/, '') + '/';
    createUntitledDir(path, 0, function (err, filename) {
      res.set('Content-Type', 'text/plain');
      return res.send(filename);
    });
  });

  app.post(prefix + 'expressfs.dirStats', function (req, res, next) {
    var path = req.body.path;
    dirtospace(path, function (err, string) {
      res.set('Content-Type', 'text/plain');
      return res.send(string);
    });
  });

  app.post(prefix + 'expressfs.downloadDirectory', function (req, res, next) {
    var path = req.body.path;
    var string = '';
    var first = '';
    var extension = false;
    if (req.body.extension) extension = new RegExp('\.' + req.body.extension + '$');
    fs.readdir(path, function (err, files) {

      if (err) return res.send(err, 400);

      async.eachSeries(files, function (filename, callback) {

        if (extension && !filename.match(extension)) callback();else {
          string += first + filename + ' ';
          fs.readFile(path + filename, 'utf8', function (err, data) {

            if (err) return res.send(err, 400);

            string += data.replace(/\n/g, '\n ');
            callback();
          });
          first = '\n';
        }
      }, function (err, results) {
        res.send(string + '\n');
      });
    });
  });

  app.post(prefix + 'expressfs.exists', function (req, res, next) {
    var path = req.body.path;
    fs.exists(path, function (exists) {
      if (exists) res.send(path + ' exists');else res.send(path + ' does NOT exist');
    });
  });

  app.post(prefix + 'expressfs.mkdir', function (req, res, next) {
    var path = req.body.path;
    mkdirp(path, function (err) {
      if (err) return res.send(err);
      res.send('');
    });
  });

  app.post(prefix + 'expressfs.readdir', function (req, res, next) {
    var path = req.body.path;
    fs.readdir(path, function (err, contents) {
      if (err) return res.send(err, 400);
      res.send(JSON.stringify(contents));
    });
  });

  app.post(prefix + 'expressfs.readFile', function (req, res, next) {
    var path = req.body.path;
    fs.readFile(path, 'utf8', function (err, contents) {
      res.send(contents);
    });
  });

  app.post(prefix + 'expressfs.rename', function (req, res, next) {
    var oldPath = req.body.oldPath;
    var newPath = req.body.newPath;
    var p = Path.dirname(newPath);
    // todo: is mkdirp of an existing dir a noop or error?
    mkdirp(p, function () {
      fs.rename(oldPath, newPath, function (err) {
        if (err) return res.send(err);
        res.send('');
      });
    });
  });

  app.post(prefix + 'expressfs.rmdir', function (req, res, next) {

    var path = req.body.path;
    exec('rm -rf ' + path, function () {
      res.send('');
    });
  });

  app.post(prefix + 'expressfs.unlink', function (req, res, next) {
    var path = req.body.path;
    fs.unlink(path, function (err) {
      if (err) return res.send(err, 400);
      res.send('');
    });
  });

  app.post(prefix + 'expressfs.writeFile', function (req, res, next) {
    var path = req.body.path;
    var encoding = 'utf8';
    if (req.body.encoding === 'base64') encoding = 'base64';
    fs.writeFile(path, req.body.content, encoding, function (err) {
      if (err) return res.send(err);
      if (req.body.redirect) return res.redirect(req.body.redirect);
      res.send('');
    });
  });
};