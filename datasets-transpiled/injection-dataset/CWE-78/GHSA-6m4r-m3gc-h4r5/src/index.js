'use strict';

const exec = require('child_process').exec;

function isArray(value) {
  return Array.isArray(value);
}

function isObject(value) {
  return !Array.isArray(value) && typeof value === 'object';
}

function isString(value) {
  return typeof value === 'string';
}

function isTrue(value) {
  return value === true;
}

function normalizePackages(args) {
  let pkgs = [];

  if (isArray(args)) {
    for (let pkg of args) {
      if (isString(pkg)) {
        pkgs.push(pkg);
      }
    }
  } else if (isString(args)) {
    pkgs.push(args);
  }

  return pkgs;
}

function normalizeOptions(args) {
  let opts = [];

  if (isArray(args)) {
    for (let opt of args) {
      if (isString(opt)) {
        opts.push(opt);
      }
    }
  } else if (isObject(args)) {
    let keys = Object.keys(args);
    for (let key of keys) {
      let value = args[key];
      if (isTrue(value)) {
        opts.push(key);
      } else if (isString(value)) {
        opts.push(`${key}=${value}`);
      }
    }
  } else if (isString(args)) {
    opts.push(args);
  }

  return opts;
}

module.exports = function (packages, options, execOptions) {
  let args = ['npm', 'install'];
  let pkgs = normalizePackages(packages);
  let opts = normalizeOptions(options);
  let execOpts = execOptions || {};

  if (pkgs.length === 0) {
    throw new Error('Invalid package names');
  }

  for (let pkg of pkgs) {
    args.push(pkg);
  }

  for (let opt of opts) {
    args.push(opt);
  }

  return new Promise((resolve, reject) => {
    exec(args.join(' '), execOpts, (error, stdout, stderr) => {
      if (error) {
        return reject({
          error,
          stdout,
          stderr
        });
      }
      return resolve({
        error,
        stdout,
        stderr
      });
    });
  });
};