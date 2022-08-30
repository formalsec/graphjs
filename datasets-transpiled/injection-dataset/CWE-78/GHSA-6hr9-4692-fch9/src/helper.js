var exec = require('child_process').exec;

module.exports = function (exec) {
  function generateCmd(options) {
    var filters = {
      blur: ' -channel RGBA -blur 0x',
      gaussian: ' -filter Gaussian -define filter:sigma=',
      sharpen: ' -sharpen 0x',
      unsharp: ' -unsharp 0x',
      threshold: ' -threshold ',
      oilpaint: ' -paint ',
      sketch: ' -sketch ',
      metal: ' -colorspace Gray -emboss 0x',
      edge: ' -negate -colorspace Gray -edge '
    };

    return "convert " + options.image + " " + filters[options.filter] + (options.level || 5) + " -resize " + (options.size || 100) + "%" + " " + (options.to || options.image);
  }

  function executeCommand(cmd, callback) {
    exec(cmd, function (error) {
      callback(error);
    });
  }

  return {
    applyEffect: function (effect, options, callback) {
      options.filter = effect;
      var cmd = generateCmd(options);
      executeCommand(cmd, callback);
    }
  };
}(exec);