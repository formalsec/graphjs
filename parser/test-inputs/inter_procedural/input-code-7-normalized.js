var utils = require('./utils');
const v7 = function (proto) {
    const compare = function (orig, compareTo, options, cb) {
        orig = utils.escape(orig);
        compareTo = utils.escape(compareTo);
        const v1 = this._options;
        const v2 = this._options;
        const v3 = v2.imageMagick;
        var isImageMagick = v1 && v3;
        let bin;
        if (isImageMagick) {
            bin = '';
        } else {
            bin = 'gm ';
        }
        const v4 = bin + 'compare -metric mse ';
        const v5 = v4 + orig;
        const v6 = v5 + ' ';
        var execCmd = v6 + compareTo;
    };
    ;
};
const v8 = exports;
module.exports = v8;