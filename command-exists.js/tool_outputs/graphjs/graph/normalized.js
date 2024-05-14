'use strict';
const v1 = require('child_process');
var exec = v1.exec;
const v2 = require('child_process');
var execSync = v2.execSync;
var fs = require('fs');
var access = fs.access;
var accessSync = fs.accessSync;
const v3 = fs.constants;
var constants = v3 || fs;
const v4 = process.platform;
var isUsingWindows = v4 == 'win32';
var fileNotExists = function (commandName, callback) {
    const v5 = constants.F_OK;
    const v8 = function (err) {
        const v6 = !err;
        const v7 = callback(v6);
        v7;
    };
    const v9 = access(commandName, v5, v8);
    v9;
};
var fileNotExistsSync = function (commandName) {
    try {
        const v10 = constants.F_OK;
        const v11 = accessSync(commandName, v10);
        v11;
        return false;
    } catch (e) {
        return true;
    }
};
var localExecutable = function (commandName, callback) {
    const v12 = constants.F_OK;
    const v13 = constants.X_OK;
    const v14 = v12 | v13;
    const v17 = function (err) {
        const v15 = !err;
        const v16 = callback(null, v15);
        v16;
    };
    const v18 = access(commandName, v14, v17);
    v18;
};
var localExecutableSync = function (commandName) {
    try {
        const v19 = constants.F_OK;
        const v20 = constants.X_OK;
        const v21 = v19 | v20;
        const v22 = accessSync(commandName, v21);
        v22;
        return true;
    } catch (e) {
        return false;
    }
};
var CommandExistsUnix = function (commandName, callback) {
    const v34 = function (isFile) {
        const v23 = !isFile;
        if (v23) {
            const v24 = 'command -v ' + commandName;
            const v25 = v24 + ' 2>/dev/null';
            const v26 = v25 + ' && { echo >&1 \'';
            const v27 = v26 + commandName;
            const v28 = v27 + ' found\'; exit 0; }';
            const v32 = function (error, stdout, stderr) {
                const v29 = !stdout;
                const v30 = !v29;
                const v31 = callback(null, v30);
                v31;
            };
            var child = exec(v28, v32);
            return;
        }
        const v33 = localExecutable(commandName, callback);
        v33;
    };
    const v35 = fileNotExists(commandName, v34);
    v35;
};
var commandExistsWindows = function (commandName, callback) {
    const v36 = 'where ' + commandName;
    const v40 = function (error) {
        const v37 = error !== null;
        if (v37) {
            const v38 = callback(null, false);
            v38;
        } else {
            const v39 = callback(null, true);
            v39;
        }
    };
    var child = exec(v36, v40);
};
var commandExistsUnixSync = function (commandName) {
    const v41 = fileNotExistsSync(commandName);
    if (v41) {
        try {
            const v42 = 'command -v ' + commandName;
            const v43 = v42 + ' 2>/dev/null';
            const v44 = v43 + ' && { echo >&1 \'';
            const v45 = v44 + commandName;
            const v46 = v45 + ' found\'; exit 0; }';
            var stdout = execSync(v46);
            const v47 = !stdout;
            const v48 = !v47;
            return v48;
        } catch (error) {
            return false;
        }
    }
    const v49 = localExecutableSync(commandName);
    return v49;
};
var commandExistsWindowsSync = function (commandName, callback) {
    try {
        const v50 = 'where ' + commandName;
        var stdout = execSync(v50);
        const v51 = !stdout;
        const v52 = !v51;
        return v52;
    } catch (error) {
        return false;
    }
};
var cleanInput = function (input) {
    const v53 = input.replace(/'/g, '\'\'');
    const v54 = '\'' + v53;
    const v55 = v54 + '\'';
    return v55;
};
const commandExists = function (commandName, callback) {
    var cleanedCommandName = cleanInput(commandName);
    const v56 = !callback;
    const v57 = typeof Promise;
    const v58 = v57 !== 'undefined';
    const v59 = v56 && v58;
    if (v59) {
        const v64 = function (resolve, reject) {
            const v62 = function (error, output) {
                if (output) {
                    const v60 = resolve(commandName);
                    v60;
                } else {
                    const v61 = reject(error);
                    v61;
                }
            };
            const v63 = commandExists(cleanedCommandName, v62);
            v63;
        };
        const v65 = new Promise(v64);
        return v65;
    }
    if (isUsingWindows) {
        const v66 = commandExistsWindows(cleanedCommandName, callback);
        v66;
    } else {
        const v67 = commandExistsUnix(cleanedCommandName, callback);
        v67;
    }
};
module.exports = commandExists;
const v68 = module.exports;
const v71 = function (commandName) {
    var cleanedCommandName = cleanInput(commandName);
    if (isUsingWindows) {
        const v69 = commandExistsWindowsSync(cleanedCommandName);
        return v69;
    } else {
        const v70 = commandExistsUnixSync(cleanedCommandName);
        return v70;
    }
};
v68.sync = v71;