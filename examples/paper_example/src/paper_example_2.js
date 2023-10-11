var exec = require('child_process').exec
module.exports = open;

function open(target, appName, key) {
    var opener = {};

    if (appName) {
        opener[key] = "open -a " + appName;
    } else {
        opener[key] = "open";
    }
    // opener.flags = []

    return exec(opener.cmd + "");
}
