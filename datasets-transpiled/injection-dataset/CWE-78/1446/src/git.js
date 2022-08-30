var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var child = require('child_process');
var spawn = child.spawn;
var util = require('util');
var events = require('events');

var basic = require('basic');
var mkdirp = require('mkdirp');
var pushover = require('pushover-giting');

// show debug messages if process.env.DEBUG === taco
var debug = require('debug')('git');

module.exports = Git;

function Git(opts) {
	if (!(this instanceof Git)) return new Git(opts);
	events.EventEmitter.call(this);
	var self = this;

	this.opts = opts || {};

	// set up default options
	if (!opts.dir) opts.dir = process.cwd();
	this.repoDir = opts.repoDir || path.join(opts.dir, 'repos');
	this.workDir = opts.workDir || path.join(opts.dir, 'checkouts');

	this.repos = pushover(this.repoDir, {
		autoCreate: opts.autoCreate ? true : false
	});

	this.onPerm = function (repo) {
		repo.accept();
	};

	this.repos.on('push', this.onRequest.bind(this));
	this.repos.on('tag', this.onRequest.bind(this));
	this.repos.on('fetch', this.onRequest.bind(this));
	this.repos.on('info', this.onRequest.bind(this));
	this.repos.on('head', this.onRequest.bind(this));

	this.auth = basic(opts.auth);
};
//
// Inherit from `events.EventEmitter`.
//
util.inherits(Git, events.EventEmitter);

Git.prototype.onRequest = function (info) {
	var self = this;
	var repo = {
		read: info.method == 'GET',
		write: info.method !== 'GET',
		credentials: info.req.credentials,
		cwd: info.cwd,
		commit: info.commit,
		branch: info.branch,
		name: info.repo.split('/')[1].split('.')[0],
		organization: info.repo.split('/')[0],
		sidebandable: info.evName == 'push',
		action: info.evName,
		accepted: false,
		rejected: false,
		sideband: null,
		accept: function () {
			repo.accepted = true;
			if (repo.sidebandable) info.sideband().once('sideband', function (sideband) {
				repo.sideband = sideband;
				self.handlePush(repo);
			});

			info.accept();
		},
		reject: function () {
			repo.rejected = true;
			info.reject();
		}
	};

	this.onPerm(repo);
};

Git.prototype.create = function (organization, name, cb) {
	this.repos.create(path.join(organization, name), cb);
};
Git.prototype.perm = function (cb) {
	this.onPerm = cb;
};

Git.prototype.handle = function (req, res) {
	var self = this;

	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

	debug('Git.handle ' + ip + ' - ' + req.method + ' - ' + req.url);

	this.auth(req, res, function (err, credentials) {
		if (err) {
			debug('Git.handle auth invalid user/pass', ip);
			res.statusCode = 401;
			res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
			return res.end('<html><body>Need some creds son</body></html>');
			return;
		}
		req.credentials = credentials;
		debug('Git.handle auth success, accepting request');
		self.repos.handle(req, res);
	});
};

Git.prototype.init = function (dir, cb) {
	var self = this;
	fs.exists(dir, function (exists) {
		if (exists) return cb();
		mkdirp(dir, function (err) {
			if (err) return cb(err);
			debug('Git.init creating new bare repo in ' + dir);
			child.exec('git init --bare', {
				cwd: dir
			}, cb);
		});
	});
};

Git.prototype.handlePush = function (repo, cb) {
	var self = this;
	if (!cb) cb = function noop() {
		//
	};

	var checkoutDir = self.checkoutDir(repo.organization, repo.name);
	self.update(repo, function (err) {
		if (err) {
			repo.sideband.write('checkout error ' + err.message + '\n');
			debug('Git.handlePush update err: ' + err);
			return cb(err);
		}
		self.emit('sideband', repo);
	});
};

Git.prototype.checkoutDir = function (organization, name) {
	return path.join(this.workDir, organization, name);
};

Git.prototype.update = function (repo, cb) {
	var self = this;
	fs.exists(this.checkoutDir(repo.organization, repo.name), function (exists) {
		debug(repo.name + ' exists? ' + exists);
		if (!exists) return self.checkout(repo, cb);
		self.pull(repo, cb);
	});
};

Git.prototype.createDir = function (organization, name, cb) {

	var dir = path.join(this.repoDir, organization, name);

	this.init(dir, cb);
};

Git.prototype.checkout = function (repo, cb) {
	var self = this;
	var dir = this.checkoutDir(repo.organization, repo.name);
	mkdirp(dir, init);

	function init(err) {
		if (err) return cb('mkdirp(' + dir + ') failed');
		debug('mkdirp() ' + dir + ' finished');
		child.exec('git init', {
			cwd: dir
		}, function (err, stdo, stde) {
			if (err) return cb(err);
			debug('init() ' + dir + ' finished');
			fetch();
		});
	}

	function fetch() {
		var cmd = ['git', 'fetch', 'file://' + path.resolve(self.repoDir, repo.organization, repo.name), encodeURIComponent(repo.branch)].join(' ');

		child.exec(cmd, {
			cwd: dir
		}, function (err) {
			if (err) return cb(err);
			debug('fetch() ' + dir + ' finished');
			checkout();
		});
	}

	function checkout() {
		var cmd = ['git', 'checkout', '-b', encodeURIComponent(repo.branch), repo.commit].join(' ');

		child.exec(cmd, {
			cwd: dir
		}, function (err, stdo, stde) {
			cb(err, stdo, stde);
		});
	}
};

Git.prototype.pull = function (repo, cb) {
	var self = this;
	var dir = this.checkoutDir(repo.organization, repo.name);
	repo.id = repo.commit + '.' + Date.now();
	var cmd = ['git', 'pull', 'file://' + path.resolve(self.repoDir, repo.organization, repo.name), encodeURIComponent(repo.branch)].join(' ');
	debug('Git.pull ' + dir + ': ' + cmd);
	child.exec(cmd, {
		cwd: dir
	}, function (err) {
		debug('Git.pull ' + dir + ' done: ' + err);
		if (err) return cb(err);
		cb(null);
	});
};