const http = require("http");
// Config
const config = require("./config");
// Utils
const mime = require("./utils/mime.js");
const fileSystem = require("./utils/file-system");

const server = http.createServer(async (req, res) => {
    let readStream;
    const { url } = req;
    const entryName = config.getOption('entryName');

    if (url == "/") {
        readStream = fileSystem.createReadStream(entryName);
        res.writeHead(200, { 'Content-Type': 'text/html' });
    } else {
        const mimeType = mime.findMimeType(url);
        readStream = fileSystem.createReadStream(url);
        res.writeHead(200, { 'Content-Type': `${mimeType}` });
    }

    readStream.on('open', () => {
        readStream.pipe(res);
    });

    readStream.on('error', err => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ err }));
    });
});

function start() {
    const port = config.getOption('port');
    const host = config.getOption('host');

    server.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port}/`);
    });
    server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
            console.error(`${port} already in use`);
        } else {
            console.error(err);
        }
    });
}
module.exports = { start };