const { exec } = require('child_process');

function f() {
    x = "hello";
    exec(`ls -l ${x}`);
}