/* jshint node: true */
'use strict';

var fs = require('fs');
var exec = require('child_process').exec;
var tmp = require('tmp');

/*
 * Create a certificate request extensions file.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit.
 * info: Object containing an optional 'subjectaltname' string property
 *       listing the alternate subject names, if any.
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the extensions config file, if successful.
 */
var createExtensionsFile = exports.createExtensionsFile = function createExtensionsFile(opts, info, cb) {
	var s = '[v3_ca]\n';
	if (info.subjectaltname) {
		s = s + 'subjectAltName = ' + info.subjectaltname + '\n';
	}
	tmp.file(opts, function tmpFileCb(err, path) {
		if (err) {
			return cb(err);
		}
		fs.writeFile(path, s, function writeFileCb(err) {
			cb(err, path);
		});
	});
};

/*
 * Create a certificate request configuration file.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit.
 * info: Object containing a required 'subject' property containing subject's
 *       distinguished name information.
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the certificate request file, if successful.
 */
var createCertRequestConfig = exports.createCertRequestConfig = function createCertRequestConfig(opts, info, cb) {
	var hash = info.subject;
	var s = '[ req ]\n' + 'default_bits       = 2048\n' + 'default_keyfile    = keyfile.pem\n' + 'distinguished_name = req_distinguished_name\n' + 'prompt             = no\n\n' + '[ req_distinguished_name ]\n';

	var allowableKeys = { C: 1, ST: 1, L: 1, O: 1, OU: 1, CN: 1 };
	Object.keys(hash).forEach(function filterCertReqKeys(key) {
		if (key in allowableKeys) {
			var val = hash[key];
			if (Array.isArray(val)) {
				val = val[0]; // hack to handle OUs that are arrays of strings
			}
			s = s + key + ' = ' + val + '\n';
		}
	});

	tmp.file(opts, function tmpFileCb(err, path) {
		if (err) {
			return cb(err);
		}
		fs.writeFile(path, s, function writeFileCb(err) {
			cb(err, path);
		});
	});
};

/*
 * Create a keypair.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit.
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
var createKeypair = exports.createKeypair = function createKeypair(opts, cb) {
	tmp.file(opts, function tmpFileCb(err, path) {
		if (err) {
			return cb(err);
		}
		var cmd = 'openssl genrsa -out ' + path + ' 2048';
		exec(cmd, function execCb(err) {
			cb(err, path);
		});
	});
};

/*
 * Create a certification request.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit.
 * keyPath: the file containing the subject's public key
 * cfgPath: the request configuration file
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
var createCertRequest = exports.createCertRequest = function createCertRequest(opts, keyPath, cfgPath, cb) {
	tmp.file(opts, function tmpFileCb(err, path) {
		if (err) {
			return cb(err);
		}
		var cmd = 'openssl req -new -key ' + keyPath + ' -config ' + cfgPath + ' -out ' + path;
		exec(cmd, function execCb(err) {
			cb(err, path);
		});
	});
};

/*
 * Create a signed certificate from request file.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit.
 * reqPath: the certification request file
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
var createCert = exports.createCert = function createCert(opts, reqPath, caKeyPath, caCertPath, extPath, cb) {
	tmp.file(opts, function tmpFileCb(err, path) {
		if (err) {
			return cb(err);
		}
		var setDays = '';
		if (expiryDays && expiryDays === parseInt(expiryDays, 10)) {
			setDays = ' -days ' + expiryDays;
		}
		var cmd = 'openssl x509 -req -in ' + reqPath + ' -CAkey ' + caKeyPath + ' -CA ' + caCertPath + ' -out ' + path + ' -CAcreateserial' + ' -extensions v3_ca -extfile ' + extPath + setDays;
		exec(cmd, function execCb(err) {
			if (err) {
				return cb(err);
			}
			var cmd2 = 'openssl x509 -noout -in ' + path + ' -fingerprint -hash';
			exec(cmd2, function statsCb(err, stdout) {
				var output = stdout.toString().split(/\n/);
				cb(err, path, output[0], output[1]);
			});
		});
	});
};

/*
 * Generate a signed certificate from supplied information.
 * prefix: Temporary file prefix.
 * keepFiles: Whether to keep generated files upon process exit.
 * info: Object containing a required 'subject' property containing subject's
 *       distinguished name information, and an optional 'subjectaltname' string property
 *       listing the alternate subject names, if any.
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, keyPath, certPath)
 */
var generateCert = exports.generateCert = function generateCert(prefix, keepFiles, info, caKeyPath, caCertPath, cb) {
	var tmpFiles = [];
	prefix = prefix.replace(/\W/g, '');
	var opts = { prefix: prefix + '-', postfix: '.pem' };
	createKeypair(opts, function createKeypairCb(err, keyPath) {
		if (err) {
			return cb(err);
		}
		opts.postfix = '.cfg';
		createCertRequestConfig(opts, info, function requestConfigCb(err, cfgPath) {
			if (err) {
				return cb(err);
			}
			tmpFiles.push(cfgPath);
			opts.postfix = '.ext';
			opts.prefix = prefix + '-';
			createExtensionsFile(opts, info, function extensionsFileCb(err, extPath) {
				if (err) {
					return cb(err);
				}
				tmpFiles.push(extPath);
				opts.postfix = '.pem';
				opts.prefix = prefix + '-csr-';
				createCertRequest(opts, keyPath, cfgPath, function certRequestCb(err, reqPath) {
					if (err) {
						return cb(err);
					}
					tmpFiles.push(reqPath);
					opts.prefix = prefix + '-cert-';
					function createCertCb(err, certPath, fingerprint, hash) {
						if (!keepFiles) {
							tmpFiles.forEach(function deleteTmpFiles(path) {
								fs.unlink(path, err => {
									if (err) {
										return cb(err);
									}
								});
							});
						}
						cb(err, keyPath, certPath, fingerprint, hash);
					}
					createCert(opts, reqPath, caKeyPath, caCertPath, extPath, createCertCb);
				});
			});
		});
	});
};

/*
 * Same as generateCert, except that key and certificate contents are returned
 * as buffers instead of paths.
 *
 * prefix: Temporary file prefix.
 * keepFiles: Whether to keep generated files upon process exit.
 * info: Object containing a required 'subject' property containing subject's
 *       distinguished name information, and an optional 'subjectaltname' string property
 *       listing the alternate subject names, if any.
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, keyBuf, certBuf)
 */
exports.generateCertBuffer = function generateCertBuf(prefix, keepFiles, info, caKeyPath, caCertPath, cb) {
	function generateCertCb(err, keyPath, certPath, fingerprint, hash) {
		if (err) {
			return cb(err);
		}
		fs.readFile(certPath, function readCertCb(err, certBuf) {
			if (err) {
				return cb(err);
			}
			fs.readFile(keyPath, function readKeyCb(err, keyBuf) {
				if (!keepFiles) {
					fs.unlink(certPath, err => {
						if (err) {
							return cb(err);
						}
					});
					fs.unlink(keyPath, err => {
						if (err) {
							return cb(err);
						}
					});
				}
				cb(err, keyBuf, certBuf, fingerprint, hash);
			});
		});
	}
	generateCert(prefix, keepFiles, info, caKeyPath, caCertPath, generateCertCb);
};

var expiryDays;
exports.setExpiryDays = function (val) {
	expiryDays = val;
};