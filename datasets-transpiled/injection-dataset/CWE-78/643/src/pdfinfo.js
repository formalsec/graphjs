const { exec, execSync } = require('child_process');
const utils = require('./utils');

function pdfinfo(filename, options) {
  this.options = options || {};
  this.options.additional = ['"' + filename + '"'];

  pdfinfo.prototype.add_options = function (optionArray) {
    if (typeof optionArray.length !== undefined) {
      var self = this;
      optionArray.forEach(function (el) {
        if (el.indexOf(' ') > 0) {
          var values = el.split(' ');
          self.options.additional.push(values[0], values[1]);
        } else {
          self.options.additional.push(el);
        }
      });
    }
    return this;
  };

  pdfinfo.prototype.getInfoSync = function () {
    const self = this;
    try {
      let data = execSync('pdfinfo ' + self.options.additional.join(' ')).toString('utf8');
      return utils.parse(data);
    } catch (err) {
      throw new Error("pdfinfo error: " + err.msg);
    }
  };

  pdfinfo.prototype.getInfo = function (cb) {
    let self = this;
    let child = exec('pdfinfo ' + self.options.additional.join(' '), function (error, stdout, stderr) {
      if (!error) {
        let data = utils.parse(stdout);
        if (cb && typeof cb === "function") {
          cb(null, data, self.options.additional);
        }
      } else {
        console.info('pdfinfo (poppler-utils) is missing. Hint: sudo apt-get install poppler-utils');
        if (cb && typeof cb === "function") {
          cb(new Error(stderr), null, self.options.addtional);
        }
      }
    });
  };

  pdfinfo.prototype.error = function (callback) {
    this.options.error = callback;
    return this;
  };

  pdfinfo.prototype.success = function (callback) {
    this.options.success = callback;
    return this;
  };
}

// module exports
exports = module.exports = function (filename, args) {
  return new pdfinfo(filename, args);
};