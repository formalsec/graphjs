// server.js

// BASE SETUP
// =============================================================================
"use strict";

// call the packages we need

const express = require('express'); // call express
const app = express(); // define our app using express
const bodyParser = require('body-parser');
const dns = require('dns');
const rpi_live_module = require('./pi_video_recording');
const globalConf = require('./config.json');
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const port = globalConf.port; // set our port
process.title = "pi_video_recording";
// ROUTES FOR OUR API
// =============================================================================
const router = express.Router(); // get an instance of the express Router

//VARIABLES

let state = 0;

let video = {};
let recordTimer;
const recordTimeout = globalConf.recordTimeout;
const allowedOrigins = globalConf.allowedOrigins;
const videoFolderPath = globalConf.writePath;

// middleware to use for all requests
router.use(function (req, res, next) {
  //my.domain:8000 -> return my.domain
  const host = req.headers.host.split(":")[0];
  const ip = req.connection.remoteAddress.replace(/^.*:/, '');
  console.log(`Request received from ${host} -> ${ip}`);

  //crossDomain control
  if (allowedOrigins[0] == "*") {
    res.header('Access-Control-Allow-Origin', host);
  } else if (allowedOrigins.indexOf(host) > -1) {
    res.header('Access-Control-Allow-Origin', host);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  next();
});

// test route to make sure it is working (accessed at GET http://localhost:5353/api)
router.get('/', function (req, res) {
  res.json({ message: 'It works ! You\'re plugged into pi_video_recording' });
});

/**
 * method : GET
 * /api/state
 * return the current state
 * @return JSON
 **/
router.get('/state', function (req, res) {
  console.log('Getting the state');
  switch (state) {
    case 0:
      res.json({
        message: 'Raspberry is ready',
        state: state
      });
      break;
    case 1:
      res.json({
        message: 'Live streaming is started',
        state: state
      });
      break;
    case 2:
      res.json({
        message: 'video recording is started',
        state: state
      });
      break;
    default:
      res.status(500);
      res.send('Oops! There is a problem with the server');
      break;
  }
});

/**
 * method : POST
 * /api/live/start
 * starts the live streaming
 * @return JSON
 **/
router.route('/live/start').post(function (req, res) {
  console.log(`Starting the live on port ${globalConf.livePort}`);
  if (state == 0) {
    rpi_live_module.startLive();
    state = 1;
    res.json({ message: 'Starting the live !' });
  } else {
    res.status(401);
    res.json({ message: 'Server is buzy, please stop current task' });
  }
});

/**
 * method : POST
 * /api/live/stop
 * stops the live streaming
 * @return JSON
 **/
router.route('/live/stop').post(function (req, res) {
  console.log('Stopping the live');
  if (state == 1) {
    rpi_live_module.stopLive(function () {
      state = 0;
      res.json({ message: 'Live stopped !' });
    });
  } else {
    res.status(401);
    res.json({ message: 'Server is buzy, please stop current task' });
  }
});

/**
 * method : POST
 * /api/record/start
 * starts the recording
 * @return JSON
 **/
router.route('/record/start').post(function (req, res) {
  console.log('Calling /record/start');
  let filename = req.body.filename;
  video.start = new Date().getTime();
  if (filename == undefined) {
    res.status(403);
    res.json({ message: 'This method requires filename parameter' });
  } else {
    if (state == 0) {
      video.filename = `${videoFolderPath}/${filename}`;
      console.log(`Trying to start record in ${video.filename}`);
      rpi_live_module.startRecord(`${video.filename}`);
      state = 2;
      res.json({ message: `Video recording started -> ${video.filename}` });
      recordTimer = setTimeout(function () {
        rpi_live_module.stopRecord(video.filename, function () {
          console.log(`Timeout reached for file ${video.filename}`);
        });
        video = {};
        state = 0;
      }, recordTimeout);
    } else {
      res.status(401);
      res.json({ message: 'Server is buzy, please stop current task' });
    }
  }
});

/**
 * method : POST
 * /api/record/stop
 * stops the recording
 * @return JSON
 **/
router.route('/record/stop').post(function (req, res) {
  console.log('Trying to stop video recording');
  if (state == 2) {
    clearTimeout(recordTimer);
    video.length = new Date().getTime() - video.start;
    rpi_live_module.stopRecord(video.filename, function () {
      state = 0;
      res.json({
        message: 'Video recording stopped !',
        length: video.length,
        filename: video.filename
      });
      video = {};
    });
  } else {
    res.status(401);
    res.json({ message: 'Server is buzy, please stop current task' });
  }
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Projet started on port ' + port);