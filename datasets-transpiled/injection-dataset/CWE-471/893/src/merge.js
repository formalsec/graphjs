var typeOf = require('lutils-typeof');

/**
 *  Merges objects together
 */
function merge() {
    var options = _parseArguments(arguments);

    options.tests.unshift(merge.tests.merge);

    return _reducer(options);
}

/**
 *  Merges objects together, but only when keys dont match
 */
merge.black = function mergeBlack() {
    var options = _parseArguments(arguments);

    options.tests.unshift(merge.tests.black);

    return _reducer(options);
};

/**
 *  Merges objects together, but only when keys match
 */
merge.white = function mergeWhite() {
    var options = _parseArguments(arguments);

    options.reversed = true;
    options.tests.unshift(merge.tests.white);

    return _reducer(options);
};

merge.tests = {
    merge: function (params) {
        if (params.assigning) return true;

        return params.key in params.obj1;
    },
    white: function (params) {
        if (params.recursing) return true;

        return params.key in params.obj2;
    },
    black: function (params) {
        if (params.recursing) return true;

        return !(params.key in params.obj1);
    }
};

module.exports = merge;

//
// Private functions
//


function _reducer(options) {
    var target = options.objects[0];
    var len = options.objects.length;

    for (var i = 1; i < len; ++i) _iterate(target, options.objects[i], options.depth, options);

    return target;
}

/**
 *  Parses `arguments` and generates an options config object
 *
 *  @param     {arguments}    args
 *
 *  @return    {Object}       options
 */
function _parseArguments(args) {
    var options = {
        depth: 8,
        types: { object: true, array: true },
        tests: []
    };

    args = Array.prototype.slice.call(args);

    if (typeOf.Array(args[0])) {
        var lastArg = args[args.length - 1];

        if (typeOf.Function(lastArg)) {
            options.tests.push(lastArg);
            args.pop();
        }

        if (args[1]) {
            options.depth = args[1].depth !== undefined ? args[1].depth : options.depth;
            options.types = _castTypes(args[1].types || options.types);

            if (args[1].test) options.tests.push(args[1].test);
        }

        options.objects = args[0];
    } else {
        options.objects = args;
    }

    return options;
}

/**
 *  Mutates `obj1` based on `options` recursively
 *
 *  @param     {Object}    obj1
 *  @param     {Object}    obj2
 *  @param     {Number}    depth
 *  @param     {Object}    options
 *
 *  @return    {Object}    obj1
 */
function _iterate(obj1, obj2, depth, options) {
    if (--depth < 0) return obj1;

    var iterated = options.reversed ? obj1 : obj2;

    for (var key in iterated) {
        if (!obj2.hasOwnProperty(key)) continue;

        var obj1Type = typeOf(obj1[key]);
        var obj2Type = typeOf(obj2[key]);

        var testOptions = {
            obj1: obj1,
            obj2: obj2,
            iterated: iterated,
            key: key,
            depth: depth,
            options: options,
            assigning: false,
            recursing: false
        };

        if (obj2Type in options.types && obj1Type in options.types) {
            testOptions.recursing = true;
            if (!_runTests(options.tests, testOptions)) continue;

            _iterate(obj1[key], obj2[key], depth, options);
        } else {
            testOptions.assigning = true;
            if (!_runTests(options.tests, testOptions)) continue;

            obj1[key] = obj2[key];
        }
    }

    return obj1;
}

/**
 *  Runs each function in `tests`, returning false if any return falsy
 *
 *  @param     {Array}     tests
 *  @param     {Object}    options
 *
 *  @return    {Boolean}
 */
function _runTests(tests, options) {
    for (var i in tests) if (!tests[i](options)) return false;

    return true;
}

/**
 *  Casts `types` to a hash object from an array of type strings
 *
 *  @param     {mixed}    types
 *
 *  @return    {Object}
 */
function _castTypes(types) {
    if (typeOf.Object(types)) return types;

    return types.reduce(function (hash, key) {
        hash[key] = true;return hash;
    }, {});
}