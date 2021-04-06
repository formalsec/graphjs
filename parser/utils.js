let VAR_COUNT = 0;
let NODE_COUNT = 0;

const DEBUG = false;

function printDebug(string) {
    if (!DEBUG) return;
    console.log(JSON.stringify(string, null, 2));
}

module.exports = {
    VAR_COUNT,
    NODE_COUNT,
    printDebug
};

