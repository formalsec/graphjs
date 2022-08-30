var _, child_process, utils;

_ = require('lodash');

child_process = require('child_process');

utils = require('./utils');

/**
 * @summary Unmount a device
 * @public
 * @function
 *
 * @description
 * It does nothing for Windows.
 *
 * @param {String} device - device path
 * @param {Function} callback - callback (error, stdout, stderr)
 *
 * @example
 * umount.umount '/dev/disk2', (error, stdout, stderr) ->
 *		throw error if error?
 */

exports.umount = function (device, callback) {
  var unmountCommand;
  if (device == null) {
    throw new Error('Missing device');
  }
  if (!_.isString(device)) {
    throw new Error("Invalid device: " + device);
  }
  if (callback == null) {
    throw new Error('Missing callback');
  }
  if (!_.isFunction(callback)) {
    throw new Error("Invalid callback: " + callback);
  }
  if (utils.isWin32()) {
    return callback(null, null, null);
  }
  if (utils.isMacOSX()) {
    unmountCommand = '/usr/sbin/diskutil unmountDisk force';
  } else {
    unmountCommand = 'umount';
  }
  device = "\"" + device + "\"";
  if (utils.isLinux()) {
    device += '?* 2>/dev/null || /bin/true';
  }
  return child_process.exec(unmountCommand + " " + device, callback);
};

/**
 * @summary Check if a device is mounted
 * @public
 * @function
 *
 * @description
 * It always returns true in Windows.
 *
 * @param {String} device - device path
 * @param {Function} callback - callback (error, isMounted)
 *
 * @example
 * umount.isMounted '/dev/disk2', (error, isMounted) ->
 *		throw error if error?
 *		console.log("Is mounted? #{isMounted}")
 */

exports.isMounted = function (device, callback) {
  if (device == null) {
    throw new Error('Missing device');
  }
  if (!_.isString(device)) {
    throw new Error("Invalid device: " + device);
  }
  if (callback == null) {
    throw new Error('Missing callback');
  }
  if (!_.isFunction(callback)) {
    throw new Error("Invalid callback: " + callback);
  }
  if (utils.isWin32()) {
    return callback(null, true);
  }
  return child_process.exec('mount', function (error, stdout, stderr) {
    if (error != null) {
      return callback(error);
    }
    if (!_.isEmpty(stderr)) {
      return callback(new Error(stderr));
    }
    return callback(null, stdout.indexOf(device) !== -1);
  });
};