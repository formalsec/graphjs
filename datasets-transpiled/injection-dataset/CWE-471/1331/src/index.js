var myGlobal = {};

/**
 *
 * Useful for longer api chains where you have to test each object in
 * the chain, or when you have an object reference in string format.
 * Objects are created as needed along `path`. Returns the passed
 * value if setting is successful or `undefined` if not.
 *
 *  @param name
 *  @param value
 *  @param context
 *  @returns {*}
 */
function set(name, value, context) {
    context = context || myGlobal;

    var parts = name.split('.');
    var p = parts.pop();
    var obj = _get(parts, true, context);
    return obj && p ? obj[p] = value : undefined; // Object
}

/**
 *
 * @param parts
 * @param create
 * @param defaultValue
 * @param context
 * @returns {*|_get}
 * @private
 */
function _get(parts, create, defaultValue, context) {
    context = context || this;
    create = create || false;
    defaultValue = defaultValue || null;

    var p,
        i = 0;

    while (context && (p = parts[i++])) {
        context = p in context ? context[p] : create ? context[p] = {} : defaultValue;
    }
    return context;
}

/**
 *
 * get object by path
 *
 * @param path
 * @param defaultValue
 * @param context
 * @returns {*|_get}
 */
function get(path, defaultValue, context) {
    var parts = path.split('.');
    return _get(parts, false, defaultValue, context);
}

exports.get = get;
exports.set = set;