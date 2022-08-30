/**
 * Created by daniel.irwin on 6/20/16.
 */

function arupex_deep_setter(obj, accessor, value) {

    if (!obj) {
        obj = {};
    }

    var keys = accessor.split('.');

    var ref = obj;

    var index = 0;

    function cleanupIndexAccessor(key) {
        return key.replace('[@', '').replace(']', '');
    }

    keys.forEach(function (key) {
        var lookAhead = keys[index + 1];

        key = cleanupIndexAccessor(key);

        if (typeof ref[key] === 'undefined') {
            if (lookAhead && lookAhead.indexOf('[@') > -1 && !isNaN(cleanupIndexAccessor(lookAhead))) {
                ref[key] = [];
            } else {
                ref[key] = {};
            }
        }
        if (index === keys.length - 1) {
            ref[key] = value;
        }
        ref = ref[key];
        ++index;
    });

    return obj;
}

if (typeof module !== 'undefined') {
    module.exports = arupex_deep_setter;
}