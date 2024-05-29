var exec = require('child_process').exec;


module.exports = open;

function open(target, appName, callback) {

    return exec(escape(target), callback);
}

function escape(s) {
    return s.replace("1","2");
}
