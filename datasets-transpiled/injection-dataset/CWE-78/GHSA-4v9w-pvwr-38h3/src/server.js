/* eslint no-console:0 */

var loopback = require('loopback');
var boot = require('loopback-boot');
var childProcess = require('child_process');
var async = require('async');
var path = require('path');
var debug = require('debug')('strong-nginx-controller:server');
var nginxConf = require('./nginx-conf');

function setup(baseDir, nginxPath, controlEndpoint, listenEndpoint, nginxRoot) {
  var app = loopback();

  app.set('nginxPath', nginxPath);

  // Set the IP and port that server should listen on
  app.set('host', controlEndpoint.hostname);
  app.set('port', controlEndpoint.port);

  // Set Nginx listen port
  app.set('nginxHost', listenEndpoint.hostname);
  app.set('nginxPort', listenEndpoint.port);
  app.set('nginxRoot', nginxRoot);

  app.set('baseDir', baseDir);

  function _reloadNginx(next) {
    async.series([nginxConf.bind(null, app), app._nginxCmd.bind(app, 'reload')], function (err) {
      if (err) return next(err);

      app.emit('reloaded');
      console.log('StrongLoop Nginx Controller listening at: http://%s:%s', app.get('host'), app.get('port'));
      next();
    });
  }
  app._reloadNginx = _reloadNginx;

  function _configureNginx(next) {
    nginxConf(app, next);
  }
  app._configureNginx = _configureNginx;

  /**
   * start/stop/reload Nginx daemon.
   *
   * @param action
   * @param cb
   * @private
   */
  function _nginxCmd(action, cb) {
    var nginxConfdir = path.join(app.get('baseDir'), 'nginx');
    var configFile = path.join(nginxConfdir, 'nginx.conf');

    var cmd = [app.get('nginxPath'), '-p', nginxConfdir, '-c', configFile];
    if (action !== 'start') cmd.push('-s', action);

    debug('CMD: %s', cmd.join(' '));
    childProcess.exec(cmd.join(' '), function (err, stdout, stderr) {
      if (err) debug('error', err);
      debug('stdout: <\n%s>', stdout);
      debug('stderr: <\n%s>', stderr);
      cb(err);
    });
  }
  app._nginxCmd = _nginxCmd;

  function start(cb) {
    var controlAddr;
    async.series([function (done) {
      app.listen(function () {
        controlAddr = this.address();
        debug('control listened on:', this.address());
        return done();
      });
    }, app._configureNginx.bind(app), app._nginxCmd.bind(app, 'start')], function (err) {
      if (err) {
        console.log('Error starting: ', err.message);
        throw err;
      }

      if (debug.enabled) app.emit('started'); // Enable Explorer

      app.emit('listening', controlAddr);

      if (cb) return cb();
    });
  }
  app.start = start;

  function stop(cb) {
    app._nginxCmd('stop', cb);
  }
  app.stop = stop;
  stopWhenDone(app);

  // Set up the /favicon.ico
  app.use(loopback.favicon());

  // request pre-processing middleware
  app.use(loopback.compress());

  // -- Add your pre-processing middleware here --

  // boot scripts mount components like REST API
  boot(app, __dirname);

  // -- Mount static files here--
  // All static middleware should be registered at the end, as all requests
  // passing the static middleware are hitting the file system
  // Example:
  //   var path = require('path');
  //   app.use(loopback.static(path.resolve(__dirname, '../client')));

  // Requests that get this far won't be handled
  // by any middleware. Convert them into a 404 error
  // that will be handled later down the chain.
  app.use(loopback.urlNotFound());

  // The ultimate error handler.
  app.use(loopback.errorHandler());

  return app;
}

function stopWhenDone(app) {
  function dieBy(signal) {
    console.log('stopped with %s', signal);
    app.stop(function (err) {
      if (err) {
        debug('Error while exiting: ', err);
        console.log('An error occurred while stopping. ' + 'There may be a stale nginx process.');
      }

      // re-kill ourself, so our exit status is signaled
      process.kill(process.pid, signal);
    });
  }

  function dieOn(signal) {
    process.once(signal, dieBy.bind(null, signal));
  }

  dieOn('SIGINT');
  dieOn('SIGTERM');

  process.on('exit', function () {
    app.stop();
  });

  process.once('SIGHUP', app._reloadNginx.bind(app));
}
module.exports = setup;