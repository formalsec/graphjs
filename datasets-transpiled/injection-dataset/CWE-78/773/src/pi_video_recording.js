// rpi_live_module.js
// ========
"use strict";

const childProcess = require('child_process');
const fs = require('fs');
const treeKill = require('tree-kill');
const globalConf = require('./config.json');
const execSync = childProcess.execSync;

const writePath = globalConf.writePath;
const livePort = globalConf.livePort;
const width = globalConf.size.width;
const height = globalConf.size.height;

let hostname = ` ${execSync("hostname")}`;
hostname = hostname.replace(/\s/g, '');

let logStream;
let proc;

const writeLogs = function (fileName) {
  const logPath = `${writePath}/${hostname}_${fileName}.log`;
  console.log(`Writing logs in ${logPath}`);
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  //flags 'a' ->  Open file for appending. The file is created if it does not exist.
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);
};

module.exports = {
  startLive: function () {
    proc = childProcess.exec(`raspivid -o - -t 0 -ih -n -pf high -ISO 800 -ex night -vs -drc high -fps 30 -w ${width} -h ${height} -r ${hostname} 
      | cvlc -vvv stream:///dev/stdin --sout '#standard{access=http,mux=ts,dst=:${livePort}}' --demux=h264 --h264-fps=30.0000`);
    proc.title = 'live';
    writeLogs("live");
  },
  stopLive: function (callback) {
    console.log('killing pid : ' + proc.pid);
    treeKill(proc.pid, 'SIGINT');
    setTimeout(function () {
      callback();
    }, 2500);
  },
  startRecord: function (file) {
    proc = childProcess.spawn("raspivid", ["-o", file + ".h264", "-t", "0", "-ih", "-pf", "high", "-ISO", "800", "-ex", "night", "-drc", "high", "-n", "-fps", "30", "-w", `${width}`, "-h", `${height}`, "-r", "90", "-b", "8000000", "-r", hostname]);

    proc.title = 'record';
    writeLogs("record");
  },
  stopRecord: function (file, callback) {
    proc.kill("SIGINT");
    // The Timeout is here to prevent problems with Stopping Nas access and finalize the video file
    const parent = this;
    setTimeout(function () {
      parent.encodeRecord(file);
      callback();
    }, 2500);
  },
  encodeRecord: function (file) {
    console.log(`Encoding file ${file} from h264 to mp4 (also removing h264)`);
    const process = childProcess.exec(`avconv -r 30 -i ${file}.h264 -threads 8 -y -loglevel quiet -vcodec copy ${file}.mp4 && rm ${file}.h264`);
    process.title = "VIDEO_ENCODING";
  }
};