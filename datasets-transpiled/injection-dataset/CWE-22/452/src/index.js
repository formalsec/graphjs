#!/usr/local/bin/node

const express = require('express');
const app = express();
const request = require('request');
const fs = require('fs');
const crypto = require('crypto');
const _ = require('lodash');
const colors = require('colors');
const async = require('async');

var tasks = [parseCommandLineArgs, setupStorage, loadSettings, attachMiddleware, handlePublish, bindWebInterface, handleUserRegistration, proxyUpstreamRegistry, startServer];

async.waterfall(tasks, function (e) {
  if (e) {
    console.error('startup error: '.red, e);
  }
});

function parseCommandLineArgs(callback) {
  var argv = require('minimist')(process.argv.slice(2));
  //console.dir(argv);

  if (argv.help || argv.h) {
    // output usage info
    console.log('simple-npm-registry'.green);
    console.log('    --port [PORT #]'.yellow, '-- specify the port to listen on, default 3000');
    console.log('    --storage [directory for cache]'.yellow, '-- specify the directory to store npm cache and published packages in');

    process.exit();
  }

  callback(null, argv);
}

function setupStorage(args, callback) {
  args.storage = args.storage || './';

  //create cache dir
  fs.mkdir(args.storage + 'cache', function (err, result) {
    if (err && err.code != 'EEXIST') {
      callback(err);
    } else {
      fs.mkdir(args.storage + 'published', function (err, result) {
        if (err && err.code != 'EEXIST') {
          callback(err);
        } else {
          callback(null, args);
        }
      });
    }
  });
}

function loadSettings(args, callback) {
  var defaultSettings = {
    port: 3000,
    storageDir: args.storage,
    users: []
  };
  defaultSettings.settingsFile = defaultSettings.storageDir + 'settings.json';

  var settings;
  fs.readFile(defaultSettings.settingsFile, function (err, data) {
    if (err) {
      fs.writeFileSync(defaultSettings.settingsFile, JSON.stringify(defaultSettings, null, 4));
      settings = defaultSettings;
    } else {
      settings = _.defaults(JSON.parse(data), defaultSettings);
    }

    // command line arguments override settings
    if (args.p) {
      settings.port = args.p;
    }

    callback(null, args, settings);
  });
}

function attachMiddleware(args, settings, callback) {

  // gather raw POST|PUT bodies
  app.use(function (req, res, next) {
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function (chunk) {
      req.rawBody += chunk;
    });

    req.on('end', function () {
      next();
    });
  });

  // favicon.ico
  app.get('/favicon.ico', function (req, res) {
    res.status(404).send();
  });

  // parse incoming auth info assign req.user = the authed user
  app.use(function (req, res, next) {
    if (req.headers.authorization) {
      var token = req.headers.authorization.split(' ')[1];
      settings.users.forEach(function (user) {
        if (user.token === token) {
          req.user = user;
        }
      });
    }

    next();
  });

  callback(null, args, settings);
}

function handlePublish(args, settings, callback) {

  // handle publishing of packages
  // check registry upstream to make sure the package does not exist?
  app.put('/:package', function (req, res) {
    var pkgData = JSON.parse(req.rawBody);

    // create all the files posted to us
    var files = Object.keys(pkgData._attachments);
    files.forEach(function (fileName) {
      // make a directory under published for the package name
      var dir = settings.storageDir + 'published/' + req.params.package;
      fs.mkdir(dir, function (e, d) {

        var file = dir + '/' + fileName;
        fs.writeFileSync(file, new Buffer(pkgData._attachments[fileName].data, 'base64'));
        delete pkgData._attachments[fileName];
      });
    });

    // create the record for the published package
    var packagejson = settings.storageDir + 'published/' + req.params.package + '.json';
    fs.readFile(packagejson, function (err, data) {
      if (err) {
        //first publish
        fs.writeFileSync(packagejson, JSON.stringify(pkgData, null, 4));
      } else {
        //additional publish
        fs.readFile(packagejson, function (err, data) {
          var obj = JSON.parse(data);
          var newObj = {};
          _.merge(newObj, obj, pkgData);
          fs.writeFileSync(packagejson, JSON.stringify(newObj, null, 4));
        });
      }

      res.status(201).json({ ok: 'created or updated' });
    });
  });

  // Downloads for published packages
  app.get('/:package/-/:filename', function (req, res) {
    fs.readFile(settings.storageDir + 'published/' + req.params.package + '/' + req.params.filename, function (err, data) {
      if (err) {
        res.status(404).send();
      } else {
        sendFile(res, data, req.params.filename);
      }
    });
  });

  callback(null, args, settings);
}

function bindWebInterface(args, settings, callback) {

  var webInterfaceRouter = express.Router();

  webInterfaceRouter.get('/', function (req, res) {

    res.send('The web interface is not implemented yet.');
  });

  app.use('/webinterface', webInterfaceRouter);

  // redirect requests to / to the web interface
  app.get('/', function (req, res) {
    res.redirect('/webinterface');
  });

  callback(null, args, settings);
}

function handleUserRegistration(args, settings, callback) {

  // User Auth   npm login | npm adduser
  app.put('/-/user/org.couchdb.user:*', function (req, res) {
    var data = JSON.parse(req.rawBody);
    data.password = crypto.createHash('sha1').update(data.password).digest('hex');

    var found = false;
    settings.users.forEach(function (user) {
      if (user.name === data.name && user.email === data.email) {
        found = true;

        if (user.password === data.password) {
          output(user);
        } else {
          res.status(401).json({ "ok": false, "id": "org.couchdb.user:undefined" });
        }

        return FALSE;
      }
    });

    if (!found) {
      var user = {
        name: data.name,
        email: data.email,
        password: data.password
      };
      user.token = crypto.createHash('sha1').update(JSON.stringify(user)).digest('hex');
      settings.users.push(user);
      saveSettings();

      output(user);
    }

    function output(user) {
      res.status(201).json({
        ok: true,
        id: "org.couchdb.user:undefined",
        rev: "_we_dont_use_revs_any_more",
        token: user.token
      });
    }

    /*
     request({
     url: 'https://registry.npmjs.org' + req.url,
     method: 'PUT',
     body: req.rawBody,
     headers: {
     'content-type': 'application/json'
     }
     }, function(e, r, b) {
      if (e) {
     console.log('put user error', e)
      res.send('asf')
     } else {
      console.log('auth looks like ', b, r.statusCode)
       res.status(r.statusCode).send(b);
     }
      })*/
  });

  callback(null, args, settings);
}

function proxyUpstreamRegistry(args, settings, callback) {

  // File Download Proxy
  app.get('/_dl', function (req, res) {
    var url = new Buffer(req.query.path, 'base64').toString('ascii');
    var filename = url.substr(url.lastIndexOf('/') + 1);

    fs.readFile('cache/' + req.query.sha, function (err, data) {
      if (err) {
        console.log('    Caching: '.green, url);
        // cache for file does not exist, grab the remote file and, cache it, and return it
        request({
          url: url,
          method: req.method,
          encoding: null
        }, function (e, r, b) {
          if (!e && r.statusCode === 200) {
            fs.writeFileSync('cache/' + req.query.sha, b);

            sendFile(res, b, filename);
          } else {
            res.status(404).send('');
          }
        });
      } else {
        //return cached file
        sendFile(res, data, filename);
      }
    });
  });

  // should cache the json response and use it if the registry is ever down
  // only versions that have been downloaded will work though
  // could filter all versions based on what files are available
  app.all('*', function (req, res) {
    //console.log(req.method.green + ': ' + req.url);

    fs.readFile(settings.storageDir + 'published' + req.url + '.json', function (err, data) {
      if (err) {
        // no local package, forward to npmjs
        request({
          url: 'https://registry.npmjs.org' + req.url,
          method: req.method
        }, function (e, r, b) {
          log(r.statusCode.toString());

          if (!e && r.statusCode === 200) {
            b = prepout(b);
            fs.writeFileSync(settings.storageDir + 'cache' + req.url + '.json', JSON.stringify(b, null, 4));
            res.json(b);
          } else {
            // try to send cached output
            fs.readFile(settings.storageDir + 'cache' + req.url + '.json', function (err, data) {
              if (err) {
                res.status(r.statusCode).send('');
              } else {
                res.status(200).send(data);
              }
            });
          }
        });
      } else {
        log('304');
        // published modules do not need paths changed
        res.set('content-type', 'text/html');
        res.send(data);
      }
    });

    function log(status) {
      console.log(status.green + ' ' + req.method.green + ' ' + req.url);
    }

    function prepout(b) {
      var data = JSON.parse(b);
      var versions = Object.keys(data.versions);
      versions.forEach(function (ver) {
        var dist = data.versions[ver].dist;
        var path = new Buffer(dist.tarball).toString('base64');
        data.versions[ver].dist.tarball = 'http' + (req.secure ? 's' : '') + '://' + req.headers.host + '/_dl?path=' + path + '&sha=' + dist.shasum;
      });

      return data;
    }
  });

  callback(null, args, settings);
}

function startServer(args, settings, callback) {

  app.listen(settings.port, function () {
    console.log('simple-npm-registry'.green + ' listening on port ' + settings.port.toString().green);

    callback(null, args, settings);
  });
}

// save the settings object back to its file
function saveSettings() {
  fs.writeFileSync(settings.settingsFile, JSON.stringify(settings, null, 4));
}

function sendFile(res, file, filename) {
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', 'attachment; filename=' + filename);

  res.end(file, 'binary');
}