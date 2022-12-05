const express = require('express');
const {exec} = require('child_process');
const app = express();

// Listen in on root
app.get('/', (req, res) => {
    const folder = req.query.folder;
    exec(`ls -l ${folder}`, (error, stdout, stderr) => {
        res.send(stdout);
    });
});