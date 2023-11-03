const git_reset = require("./package/code")

const config = { reset: { commit: 1, branch: 'main'}}
const op_type = 'reset'
const branch_name = 'main'
const url = 'origin/main'

git_reset(config, op_type, branch_name, url)