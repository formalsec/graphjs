"use strict";

var child_process = require("child_process");
function open(path, ref) {
    "use strict";

    return Promise.resolve(new FSGit(path, ref));
}
exports.open = open;
var maxBuffer = 1 * 1024 * 1024;
var FSGit = function () {
    function FSGit(path, ref) {
        if (ref === void 0) {
            ref = "master";
        }
        this.path = path;
        this.ref = ref;
    }
    FSGit.prototype.file = function (path) {
        return this._lsTree(this.ref, path).then(function (fileList) {
            var fileInfo = fileList.filter(function (fileInfo) {
                return fileInfo.path === path;
            })[0];
            if (fileInfo) {
                return fileInfo;
            } else {
                throw new Error(path + " is not exists");
            }
        });
    };
    FSGit.prototype.fileList = function () {
        return this._lsTree(this.ref, ".");
    };
    FSGit.prototype.showRef = function () {
        var _this = this;
        var command = this._buildCommand("show-ref");
        return new Promise(function (resolve, reject) {
            child_process.exec(command, { maxBuffer: maxBuffer }, function (error, stdout, stderr) {
                if (error) {
                    reject(error);
                } else {
                    var list = stdout.toString("utf8").split("\n").filter(function (line) {
                        return !!line;
                    });
                    var resultList = list.map(function (str) {
                        var columns = str.split(" ", 2);
                        return {
                            gitDir: _this.path,
                            ref: columns[0],
                            name: columns[1]
                        };
                    });
                    resolve(resultList);
                }
            });
        });
    };
    FSGit.prototype.readFile = function (path, opts) {
        var command = this._buildCommand("show", this.ref + ":" + path);
        return new Promise(function (resolve, reject) {
            child_process.exec(command, { maxBuffer: maxBuffer }, function (error, stdout, stderr) {
                if (error) {
                    reject(error);
                } else {
                    if (opts && opts.encoding) {
                        resolve(stdout.toString(opts.encoding));
                    } else {
                        resolve(stdout);
                    }
                }
            });
        });
    };
    FSGit.prototype.exists = function (path) {
        return this.fileList().then(function (list) {
            return list.some(function (data) {
                return data.path === path;
            });
        });
    };
    FSGit.prototype.revParse = function (ref) {
        var command = this._buildCommand("rev-parse", ref);
        return new Promise(function (resolve, reject) {
            child_process.exec(command, { maxBuffer: maxBuffer }, function (error, stdout, stderr) {
                if (error) {
                    console.log(command);
                    reject(error);
                } else {
                    var list = stdout.toString("utf8").split("\n").filter(function (str) {
                        return str.length !== 0;
                    });
                    resolve(list[0]);
                }
            });
        });
    };
    FSGit.prototype._lsTree = function (ref, path) {
        var _this = this;
        if (ref === void 0) {
            ref = this.ref;
        }
        if (path === void 0) {
            path = ".";
        }
        return this.revParse(ref).then(function (ref) {
            var command = _this._buildCommand("ls-tree", "-r", "-z", "--full-name", ref, path);
            return new Promise(function (resolve, reject) {
                child_process.exec(command, { maxBuffer: maxBuffer }, function (error, stdout, stderr) {
                    if (error) {
                        reject(error);
                    } else {
                        var list = stdout.toString("utf8").split("\0").filter(function (str) {
                            return str.length !== 0;
                        });
                        var resultList = list.map(function (str) {
                            var matches = str.match(/^([0-9]+)\s([^\s]+)\s([0-9a-f]+)\t(.+)$/);
                            return {
                                gitDir: _this.path,
                                ref: ref,
                                permission: matches[1],
                                type: matches[2],
                                hash: matches[3],
                                path: matches[4]
                            };
                        });
                        resolve(resultList);
                    }
                });
            });
        });
    };
    FSGit.prototype._buildCommand = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        return "git --git-dir=" + this.path + " " + args.join(" ");
    };
    return FSGit;
}();
exports.FSGit = FSGit;
//# sourceMappingURL=index.js.map