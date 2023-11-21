const exec = require("child_process").execSync

function git_reset(config, op, branch_name, url) {
    const options = config[op]
    //options[branch_name] = url                          // Set url of a given branch
    options.cmd = 'git reset'                           // Set command
    exec(`${options.cmd} HEAD~${options.commit}`)       // Build and execute command
}

module.exports = git_reset