'use strict';
var child_process = require('child_process');
const open = function (path, ref) {
    'use strict';
    const v1 = new FSGit(path, ref);
    const v2 = Promise.resolve(v1);
    return v2;
};
exports.open = open;
const v3 = 1 * 1024;
var maxBuffer = v3 * 1024;
const v123 = function () {
    const FSGit = function (path, ref) {
        const v4 = void 0;
        const v5 = ref === v4;
        if (v5) {
            ref = 'master';
        }
        this.path = path;
        this.ref = ref;
    };
    const v6 = FSGit.prototype;
    const v17 = function (path) {
        const v7 = this.ref;
        const v8 = this._lsTree(v7, path);
        const v15 = function (fileList) {
            const v11 = function (fileInfo) {
                const v9 = fileInfo.path;
                const v10 = v9 === path;
                return v10;
            };
            const v12 = fileList.filter(v11);
            var fileInfo = v12[0];
            if (fileInfo) {
                return fileInfo;
            } else {
                const v13 = path + ' is not exists';
                const v14 = new Error(v13);
                throw v14;
            }
        };
        const v16 = v8.then(v15);
        return v16;
    };
    v6.file = v17;
    const v18 = FSGit.prototype;
    const v21 = function () {
        const v19 = this.ref;
        const v20 = this._lsTree(v19, '.');
        return v20;
    };
    v18.fileList = v21;
    const v22 = FSGit.prototype;
    const v40 = function () {
        var _this = this;
        var command = this._buildCommand('show-ref');
        const v38 = function (resolve, reject) {
            const v23 = { maxBuffer: maxBuffer };
            const v36 = function (error, stdout, stderr) {
                if (error) {
                    const v24 = reject(error);
                    v24;
                } else {
                    const v25 = stdout.toString('utf8');
                    const v26 = v25.split('\n');
                    const v29 = function (line) {
                        const v27 = !line;
                        const v28 = !v27;
                        return v28;
                    };
                    var list = v26.filter(v29);
                    const v34 = function (str) {
                        var columns = str.split(' ', 2);
                        const v30 = _this.path;
                        const v31 = columns[0];
                        const v32 = columns[1];
                        const v33 = {
                            gitDir: v30,
                            ref: v31,
                            name: v32
                        };
                        return v33;
                    };
                    var resultList = list.map(v34);
                    const v35 = resolve(resultList);
                    v35;
                }
            };
            const v37 = child_process.exec(command, v23, v36);
            v37;
        };
        const v39 = new Promise(v38);
        return v39;
    };
    v22.showRef = v40;
    const v41 = FSGit.prototype;
    const v57 = function (path, opts) {
        const v42 = this.ref;
        const v43 = v42 + ':';
        const v44 = v43 + path;
        var command = this._buildCommand('show', v44);
        const v55 = function (resolve, reject) {
            const v45 = { maxBuffer: maxBuffer };
            const v53 = function (error, stdout, stderr) {
                if (error) {
                    const v46 = reject(error);
                    v46;
                } else {
                    const v47 = opts.encoding;
                    const v48 = opts && v47;
                    if (v48) {
                        const v49 = opts.encoding;
                        const v50 = stdout.toString(v49);
                        const v51 = resolve(v50);
                        v51;
                    } else {
                        const v52 = resolve(stdout);
                        v52;
                    }
                }
            };
            const v54 = child_process.exec(command, v45, v53);
            v54;
        };
        const v56 = new Promise(v55);
        return v56;
    };
    v41.readFile = v57;
    const v58 = FSGit.prototype;
    const v66 = function (path) {
        const v59 = this.fileList();
        const v64 = function (list) {
            const v62 = function (data) {
                const v60 = data.path;
                const v61 = v60 === path;
                return v61;
            };
            const v63 = list.some(v62);
            return v63;
        };
        const v65 = v59.then(v64);
        return v65;
    };
    v58.exists = v66;
    const v67 = FSGit.prototype;
    const v82 = function (ref) {
        var command = this._buildCommand('rev-parse', ref);
        const v80 = function (resolve, reject) {
            const v68 = { maxBuffer: maxBuffer };
            const v78 = function (error, stdout, stderr) {
                if (error) {
                    const v69 = console.log(command);
                    v69;
                    const v70 = reject(error);
                    v70;
                } else {
                    const v71 = stdout.toString('utf8');
                    const v72 = v71.split('\n');
                    const v75 = function (str) {
                        const v73 = str.length;
                        const v74 = v73 !== 0;
                        return v74;
                    };
                    var list = v72.filter(v75);
                    const v76 = list[0];
                    const v77 = resolve(v76);
                    v77;
                }
            };
            const v79 = child_process.exec(command, v68, v78);
            v79;
        };
        const v81 = new Promise(v80);
        return v81;
    };
    v67.revParse = v82;
    const v83 = FSGit.prototype;
    const v110 = function (ref, path) {
        var _this = this;
        const v84 = void 0;
        const v85 = ref === v84;
        if (v85) {
            ref = this.ref;
        }
        const v86 = void 0;
        const v87 = path === v86;
        if (v87) {
            path = '.';
        }
        const v88 = this.revParse(ref);
        const v108 = function (ref) {
            var command = _this._buildCommand('ls-tree', '-r', '-z', '--full-name', ref, path);
            const v106 = function (resolve, reject) {
                const v89 = { maxBuffer: maxBuffer };
                const v104 = function (error, stdout, stderr) {
                    if (error) {
                        const v90 = reject(error);
                        v90;
                    } else {
                        const v91 = stdout.toString('utf8');
                        const v92 = v91.split('\0');
                        const v95 = function (str) {
                            const v93 = str.length;
                            const v94 = v93 !== 0;
                            return v94;
                        };
                        var list = v92.filter(v95);
                        const v102 = function (str) {
                            var matches = str.match(/^([0-9]+)\s([^\s]+)\s([0-9a-f]+)\t(.+)$/);
                            const v96 = _this.path;
                            const v97 = matches[1];
                            const v98 = matches[2];
                            const v99 = matches[3];
                            const v100 = matches[4];
                            const v101 = {
                                gitDir: v96,
                                ref: ref,
                                permission: v97,
                                type: v98,
                                hash: v99,
                                path: v100
                            };
                            return v101;
                        };
                        var resultList = list.map(v102);
                        const v103 = resolve(resultList);
                        v103;
                    }
                };
                const v105 = child_process.exec(command, v89, v104);
                v105;
            };
            const v107 = new Promise(v106);
            return v107;
        };
        const v109 = v88.then(v108);
        return v109;
    };
    v83._lsTree = v110;
    const v111 = FSGit.prototype;
    const v122 = function () {
        var args = [];
        var _i = 0;
        const v112 = arguments.length;
        let v113 = _i < v112;
        while (v113) {
            const v115 = _i - 0;
            const v116 = arguments[_i];
            args[v115] = v116;
            const v114 = _i++;
            v113 = _i < v112;
        }
        const v117 = this.path;
        const v118 = 'git --git-dir=' + v117;
        const v119 = v118 + ' ';
        const v120 = args.join(' ');
        const v121 = v119 + v120;
        return v121;
    };
    v111._buildCommand = v122;
    return FSGit;
};
var FSGit = v123();
exports.FSGit = FSGit;