const express = require('express');
const {exec} = require('child_process');
const app = express();

// Listen in on root
app.get('/', (req, res) => {
    const folder = req.query.folder;
    if (folder) {
        // Run the command with the parameter the user gives us
        exec(`ls -l ${folder}`, (error, stdout, stderr) => {
            res.send(stdout);
        });
    }
});