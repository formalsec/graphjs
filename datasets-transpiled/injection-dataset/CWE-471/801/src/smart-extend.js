(function (g, f) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = f() : typeof define === 'function' && define.amd ? define(f) : (g = g || self, g['smart-extend'] = f());
})(this, function () {
  'use strict';
  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }var _extend, isArray, isObject, _shouldDeepExtend;

  isArray = function isArray(target) {
    return Array.isArray(target);
  };

  isObject = function isObject(target) {
    return target && Object.prototype.toString.call(target) === '[object Object]' || isArray(target);
  };

  _shouldDeepExtend = function shouldDeepExtend(options, target, parentKey) {
    if (options.deep) {
      if (options.notDeep) {
        return !options.notDeep[target];
      } else {
        return true;
      }
    } else if (options.deepOnly) {
      return options.deepOnly[target] || parentKey && _shouldDeepExtend(options, parentKey);
    }
  }; // else false


  var extend = _extend = function extend(options, target, sources, parentKey) {
    var i, key, len, source, sourceValue, subTarget, targetValue;

    if (!target || _typeof(target) !== 'object' && typeof target !== 'function') {
      target = {};
    }

    for (i = 0, len = sources.length; i < len; i++) {
      source = sources[i];

      if (source != null) {
        for (key in source) {
          sourceValue = source[key];
          targetValue = target[key];

          if (sourceValue === target || sourceValue === void 0 || sourceValue === null && !options.allowNull && !options.nullDeletes || options.keys && !options.keys[key] || options.notKeys && options.notKeys[key] || options.own && !source.hasOwnProperty(key) || options.globalFilter && !options.globalFilter(sourceValue, key, source) || options.filters && options.filters[key] && !options.filters[key](sourceValue, key, source)) {
            continue;
          }

          if (sourceValue === null && options.nullDeletes) {
            delete target[key];
            continue;
          }

          if (options.globalTransform) {
            sourceValue = options.globalTransform(sourceValue, key, source);
          }

          if (options.transforms && options.transforms[key]) {
            sourceValue = options.transforms[key](sourceValue, key, source);
          }

          switch (false) {
            case !(options.concat && isArray(sourceValue) && isArray(targetValue)):
              target[key] = targetValue.concat(sourceValue);
              break;

            case !(_shouldDeepExtend(options, key, parentKey) && isObject(sourceValue)):
              subTarget = isObject(targetValue) ? targetValue : isArray(sourceValue) ? [] : {};
              target[key] = _extend(options, subTarget, [sourceValue], key);
              break;

            default:
              target[key] = sourceValue;
          }
        }
      }
    }

    return target;
  };var version = "1.7.4";var modifiers, newBuilder, normalizeKeys, primaryBuilder;

  normalizeKeys = function normalizeKeys(keys) {
    var i, key, len, output;

    if (keys) {
      output = {};

      if (_typeof(keys) !== 'object') {
        output[keys] = true;
      } else {
        if (!Array.isArray(keys)) {
          keys = Object.keys(keys);
        }

        for (i = 0, len = keys.length; i < len; i++) {
          key = keys[i];
          output[key] = true;
        }
      }

      return output;
    }
  };

  newBuilder = function newBuilder(isBase) {
    var _builder;

    _builder = function builder(target) {
      var theTarget;
      var $_len = arguments.length,
          $_i = -1,
          sources = new Array($_len);while (++$_i < $_len) sources[$_i] = arguments[$_i];

      if (_builder.options.target) {
        theTarget = _builder.options.target;
      } else {
        theTarget = target;
        sources.shift();
      }

      return extend(_builder.options, theTarget, sources);
    };

    if (isBase) {
      _builder.isBase = true;
    }

    _builder.options = {};
    Object.defineProperties(_builder, modifiers);
    return _builder;
  };

  modifiers = {
    'deep': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.deep = true;
        return _;
      }
    },
    'own': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.own = true;
        return _;
      }
    },
    'allowNull': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.allowNull = true;
        return _;
      }
    },
    'nullDeletes': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.nullDeletes = true;
        return _;
      }
    },
    'concat': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.concat = true;
        return _;
      }
    },
    'clone': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        _.options.target = {};
        return _;
      }
    },
    'notDeep': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (keys) {
          _.options.notDeep = normalizeKeys(keys);
          return _;
        };
      }
    },
    'deepOnly': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (keys) {
          _.options.deepOnly = normalizeKeys(keys);
          return _;
        };
      }
    },
    'keys': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (keys) {
          _.options.keys = normalizeKeys(keys);
          return _;
        };
      }
    },
    'notKeys': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (keys) {
          _.options.notKeys = normalizeKeys(keys);
          return _;
        };
      }
    },
    'transform': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (transform) {
          if (typeof transform === 'function') {
            _.options.globalTransform = transform;
          } else if (transform && _typeof(transform) === 'object') {
            _.options.transforms = transform;
          }

          return _;
        };
      }
    },
    'filter': {
      get: function get() {
        var _;

        _ = this.isBase ? newBuilder() : this;
        return function (filter) {
          if (typeof filter === 'function') {
            _.options.globalFilter = filter;
          } else if (filter && _typeof(filter) === 'object') {
            _.options.filters = filter;
          }

          return _;
        };
      }
    }
  };
  primaryBuilder = newBuilder(true);
  primaryBuilder.version = version;
  var primaryBuilder$1 = primaryBuilder;return primaryBuilder$1;
});