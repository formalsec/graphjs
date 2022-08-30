const fs = require('fs');
const fsp = require('fs/promises');
const path = require("path");
const config = require("../config");

const currentWorkDirectory = process.cwd();

function createReadStream(url) {
    const entryDir = config.getOption('entryDir');

    const filePath = path.join(entryDir, url);
    const readStream = fs.createReadStream(filePath);

    return readStream;
}

function findEntryPoint() {
    return new Promise(async (resolve, reject) => {
        try {
            let dirName;
            let entryPoint = config.getOption('entryPoint');
            const filePath = path.join(currentWorkDirectory, entryPoint);
            let fileName = path.basename(filePath);

            if (fileName.split(".")[1]) {
                dirName = path.dirname(filePath);
            } else {
                dirName = filePath;
                fileName = "index.html";
            }

            config.setOption("entryDir", dirName);
            config.setOption("entryName", fileName);

            const files = await fsp.readdir(dirName);

            const matchedEntryPoint = files.find(_f => _f == fileName);

            if (matchedEntryPoint) {
                resolve(matchedEntryPoint);
            } else {
                reject(`No Entry Point Found ${entryPoint}`);
            }
        } catch (err) {
            reject(`Please Type correct Entry Point Found`);
        }
    });
}

module.exports = {
    createReadStream,
    findEntryPoint
};