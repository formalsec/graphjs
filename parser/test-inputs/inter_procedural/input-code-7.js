// compare

var utils = require('./utils');

/**
 * Compare two images uses graphicsmagicks `compare` command.
 *
 * gm.compare(img1, img2, 0.4, function (err, equal, equality) {
 *   if (err) return handle(err);
 *   console.log('The images are equal: %s', equal);
 *   console.log('There equality was %d', equality);
 * });
 *
 * @param {String} orig Path to an image.
 * @param {String} compareTo Path to another image to compare to `orig`.
 * @param {Number|Object} [options] Options object or the amount of difference to tolerate before failing - defaults to 0.4
 * @param {Function} cb(err, Boolean, equality, rawOutput)
 */

module.exports = exports = function (proto) {
    function compare(orig, compareTo, options, cb) {
        orig = utils.escape(orig);
        compareTo = utils.escape(compareTo);

        var isImageMagick = this._options && this._options.imageMagick;
        // compare binary for IM is `compare`, for GM it's `gm compare`
        var bin = isImageMagick ? '' : 'gm ';
        var execCmd = bin + 'compare -metric mse ' + orig + ' ' + compareTo;
    };
}