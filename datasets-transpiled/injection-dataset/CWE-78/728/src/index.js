
var cp = require('child_process');

module.exports = exports = function (args, callback) {
	if (Array.isArray(args)) {
		args = args.join(' ');
	}
	cp.exec('ps ' + args, function (err, stdout, stderr) {
		stdout = stdout.toString('utf8');
		stderr = stderr.toString('utf8');
		if (err || stderr) {
			return callback(stderr || err);
		}
		callback(null, stdout.trim() || false);
	});
};

exports.lookup = function (query, callback) {
	var format = parseFormat(query.format || 'comm');

	// Lookup by PID
	if (query.pid) {
		var pid = query.pid;
		if (Array.isArray(pid)) {
			pid = pid.join(',');
		}
		return exports(['-p', pid, '-o', format], function (err, output) {
			if (err) {
				return callback(err);
			}
			if (query.parse) {
				output = parseGrid(output);
			}
			callback(null, output);
		});
	}

	// TODO Add other lookup types
};

// ------------------------------------------------------------------

function parseGrid(output) {
	if (!output) {
		return output;
	}
	return output.split('\n').map(function (line) {
		var returnedOutput = [];
		line.split(/\s+/).map(function (item) {
			if (item) {
				returnedOutput.push(item);
			}
		});
		return returnedOutput;
	});
}

function parseFormat(format) {
	if (typeof format === 'string') {
		format = format.split(' ');
	}
	format = format.map(function (item) {
		return item + '=';
	});
	return format.join(' -o ');
}