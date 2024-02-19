const exec = require('child_process').exec;

function git_reset(config, op, branch_name, url) {
    const options = config[op];
    options[branch_name] = url;
    options.cmd = 'git reset';
    verify_commit(options.commit)
    exec(`${options.cmd} HEAD~${options.commit}`);
}

module.exports = git_reset;
