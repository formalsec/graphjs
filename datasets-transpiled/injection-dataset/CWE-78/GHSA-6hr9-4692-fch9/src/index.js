var helper = require('./helper');

module.exports = function (helper) {
  return {
    blur: function (options, callback) {
      helper.applyEffect('blur', options, callback);
    },
    gaussian: function (options, callback) {
      helper.applyEffect('gaussian', options, callback);
    },
    sharpen: function (options, callback) {
      helper.applyEffect('sharpen', options, callback);
    },
    unsharp: function (options, callback) {
      helper.applyEffect('unsharp', options, callback);
    },
    threshold: function (options, callback) {
      helper.applyEffect('threshold', options, callback);
    },
    oilpaint: function (options, callback) {
      helper.applyEffect('oilpaint', options, callback);
    },
    sketch: function (options, callback) {
      helper.applyEffect('sketch', options, callback);
    },
    metal: function (options, callback) {
      helper.applyEffect('metal', options, callback);
    },
    edge: function (options, callback) {
      helper.applyEffect('edge', options, callback);
    }
  };
}(helper);