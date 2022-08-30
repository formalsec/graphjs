'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.handlers = exports.Schema = exports.Param = undefined;
exports.handler = handler;
exports.formatter = formatter;
exports.validator = validator;
exports.middleware = middleware;
exports.errorHandler = errorHandler;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _richParam = require('rich-param');

var _richParam2 = _interopRequireDefault(_richParam);

var _bodymenSchema = require('./bodymen-schema');

var _bodymenSchema2 = _interopRequireDefault(_bodymenSchema);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

exports.Param = _richParam2.default;
exports.Schema = _bodymenSchema2.default; /** @module bodymen */

var handlers = exports.handlers = {
  formatters: {},
  validators: {}
};

/**
 * Get or set a handler.
 * @memberof bodymen
 * @param {string} type - Handler type.
 * @param {string} name - Handler name.
 * @param {Function} [fn] - Set the handler method.
 */
function handler(type, name, fn) {
  if (arguments.length > 2) {
    handlers[type][name] = fn;
  }

  return handlers[type][name];
}

/**
 * Get or set a formatter.
 * @memberof bodymen
 * @param {string} name - Formatter name.
 * @param {formatterFn} [fn] - Set the formatter method.
 * @return {formatterFn} The formatter method.
 */
function formatter(name, fn) {
  return handler.apply(undefined, ['formatters'].concat(Array.prototype.slice.call(arguments)));
}

/**
 * Get or set a validator.
 * @memberof bodymen
 * @param {string} name - Validator name.
 * @param {validatorFn} [fn] - Set the validator method.
 * @return {validatorFn} The validator method.
 */
function validator(name, fn) {
  return handler.apply(undefined, ['validators'].concat(Array.prototype.slice.call(arguments)));
}

/**
 * Create a middleware.
 * @memberof bodymen
 * @param {BodymenSchema|Object} [schema] - Schema object.
 * @param {Object} [options] - Options to be passed to schema.
 * @return {Function} The middleware.
 */
function middleware(schema, options) {
  return function (req, res, next) {
    var _schema = schema instanceof _bodymenSchema2.default ? _lodash2.default.clone(schema) : new _bodymenSchema2.default(schema, options);

    _schema.validate(req.body, function (err) {
      if (err) {
        req.bodymen = { error: err };
        res.status(400);
        return next(err.message);
      }

      req.bodymen = { body: _schema.parse(), schema: _schema };
      next();
    });
  };
}

/**
 * Error handler middleware.
 * @memberof bodymen
 * @return {Function} The middleware.
 */
function errorHandler() {
  return function (err, req, res, next) {
    if (req.bodymen && req.bodymen.error) {
      res.status(400).json(req.bodymen.error);
    } else {
      next(err);
    }
  };
}

exports.default = {
  Schema: _bodymenSchema2.default,
  Param: _richParam2.default,
  handlers: handlers,
  handler: handler,
  formatter: formatter,
  validator: validator,
  middleware: middleware,
  errorHandler: errorHandler
};