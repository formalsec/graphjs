var exec = require('child_process').exec
module.exports = open;

function open(target, appName, callback) {
    var opener;

    if (appName) {
        opener = 'open -a "' + appName + '"';
    } else {
        opener = 'open';
    }

    return exec(opener + '""');
}
