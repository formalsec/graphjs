var express = require('express');
var _ = require('underscore');
var Priest = require('./controller.js');
var AnsiConverter = require('ansi-to-html');
var uncolor = require('uncolor');

module.exports = priestMiddleware;

function priestMiddleware(options) {
    var controller;
    if (!options) {
        controller = new Priest();
        options = {};
    } else if (options instanceof Priest) {
        controller = options;
        options = {};
    }

    var router = new express.Router();

    router.get('/', function (req, res, next) {
        controller.listProcess(function (err, list) {
            if (err) return next(err);

            list = list.map(function (info) {
                var result = normalize(info);

                delete result.process;
                delete result.log;

                return result;
            });

            res.json(list);
        });
    });

    router.get('/all', function (req, res, next) {
        controller.listProcess(true, function (err, list) {
            if (err) return next(err);

            list = list.map(function (info) {
                var result = normalize(info);

                delete result.process;
                delete result.log;

                return result;
            });

            res.json(list);
        });
    });

    router.get('/about', function (req, res, next) {
        res.json({
            name: 'Priest',
            version: controller.version
        });
    });

    router.post('/', function (req, res, next) {
        var params = req.body;

        if (!params.bin && !params.args) {
            return badRequest(res);
        }

        controller.startProcess(params, function (err, info) {
            if (err) return next(err);
            if (!info) return serverError('Unknown error');

            var result = normalize(info);
            delete result.process;
            delete result.log;

            res.json(result);
        });
    });

    // Stop all processes
    router.delete('/', function (req, res, next) {
        controller.stopAll(function (err) {
            if (err) return next(err);

            res.json(true);
        });
    });

    // Restart process
    router.put('/:id', function (req, res, next) {
        controller.restartProcess(req.params.id, function (err, info) {
            if (err) return next(err);
            if (!info) return notFound(res);

            var result = normalize(info);
            delete result.process;
            delete result.log;

            res.json(result);
        });
    });

    router.get('/:id', function (req, res, next) {
        controller.getProcess(req.params.id, function (err, info) {
            if (err) return next(err);
            if (!info) return notFound(res);

            var result = normalize(info);
            delete result.process;
            delete result.log;

            res.json(result);
        });
    });

    router.delete('/:id', function (req, res, next) {
        controller.stopProcess(req.params.id, function (err, info) {
            if (err) return next(err);
            if (!info) return notFound(res);

            res.json(true);
        });
    });

    router.get('/:id/log', function (req, res, next) {
        controller.getProcess(req.params.id, function (err, info) {
            if (err) return next(err);
            if (!info) return notFound(res);

            var logs = info.log;

            if (req.query.from) {
                var date = new Date(req.query.from);
                logs = logs.filter(function (item) {
                    return item.time >= date;
                });
            } else {
                logs = logs.slice(-(req.query.limit || 20));
            }

            var format = req.query.format || 'plain';
            var filterFn;
            var converter = new AnsiConverter({
                stream: true
            });

            if (format === 'html') {
                filterFn = function (item) {
                    return converter.toHtml(item.data);
                };
            } else {
                filterFn = function (item) {
                    return uncolor(item.data);
                };
            }

            logs = logs.map(filterFn);

            if (!req.query.stream) {
                res.header('content-type', 'text/' + format);
                res.end(logs.join(''));
                return;
            }

            var child = info.process;
            var onData;

            var write = function (data) {
                res.write('data:' + data.split('\n').join('\ndata:') + '\n\n');
            };

            if (req.query.format === 'html') {
                converter = new AnsiConverter({
                    stream: true
                });

                onData = function (chunk) {
                    var data = converter.toHtml(chunk.toString());
                    write(data);
                };
            } else {
                onData = function (chunk) {
                    var data = uncolor(chunk.toString());
                    write(data);
                };
            }

            if (info.stopped) {
                res.header('content-type', 'text/' + format);
                onData(logs.join(''));
                return;
            }

            var onExit = function () {
                res.end();
            };

            child.stdout.on('data', onData);
            child.stderr.on('data', onData);
            child.on('exit', onExit);

            // Setup connection
            // req.socket.setTimeout(Infinity);
            res.writeHead(200, {
                'content-type': 'text/event-stream',
                'cache-control': 'no-cache',
                'connection': 'keep-alive'
            });

            req.on('close', function () {
                child.stdout.removeListener('data', onData);
                child.stderr.removeListener('data', onData);
                child.removeListener('exit', onExit);
            });
        });
    });

    router.get('/:id/list', function (req, res, next) {
        controller.listNamedProcess(req.params.id, function (err, list) {
            if (err) return next(err);

            list = list.map(function (info) {
                var result = _.extend({}, info);

                delete result.process;
                delete result.log;

                return result;
            });

            res.json(list);
        });
    });

    router.use(function (err, req, res, next) {
        if (err) {
            console.error(err.stack);
            return res.status(500).format({
                json: function () {
                    res.json({
                        status: false,
                        error: err.message || err.toString()
                    });
                },
                html: function () {
                    res.end(err);
                },
                default: function () {
                    res.end(err);
                }
            });
        }

        next();
    });

    function normalize(target) {
        if (!_.isObject(target)) return target;

        if (Array.isArray(target)) {
            return target.map(normalize);
        }

        var result = {};
        Object.getOwnPropertyNames(target).forEach(function (name) {
            if (name.charAt(0) === '_') return;

            var value = target[name];
            if (_.isObject(value)) {
                if (value.constructor === Object) {
                    result[name] = normalize(value);
                } else if (Array.isArray(value)) {
                    result[name] = value.map(normalize);
                } else if (value instanceof Date) {
                    result[name] = value.toISOString();
                }
            } else {
                result[name] = value;
            }
        });

        return result;
    }

    return router;
}

function sendResponse(res, data) {
    res.status(200).format({
        json: function () {
            res.json({
                status: true,
                result: data || {}
            });
        },
        html: function () {
            res.send(data); // ?
        },
        default: function () {
            res.send(data);
        }
    });
}

function badRequest(res, message) {
    message = message || 'Bad request';

    res.status(400).format({
        json: function () {
            res.json({
                status: false,
                error: message
            });
        },
        html: function () {
            res.type('text/plain').send(message);
        },
        default: function () {
            res.type('text/plain').send(message);
        }
    });
}

function notFound(res, message) {
    message = message || 'Not found';
    res.status(404).format({
        json: function () {
            res.json({
                status: false,
                error: message
            });
        },
        html: function () {
            res.type('text/plain').send(message);
        },
        default: function () {
            res.type('text/plain').send(message);
        }
    });
}

function forbidden(res, message) {
    message = message || 'Access forbidden';
    res.status(403).format({
        json: function () {
            res.json({
                status: false,
                error: message
            });
        },
        html: function () {
            res.type('text/plain').html(message);
        },
        default: function () {
            res.type('text/plain').send(message);
        }
    });
}

function serverError(res, message) {
    message = message || 'Server error';
    res.status(500).format({
        json: function () {
            res.json({
                status: false,
                error: message
            });
        },
        html: function () {
            res.type('text/plain').send(message);
        },
        default: function () {
            res.type('text/plain').send(message);
        }
    });
}