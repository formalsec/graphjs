const ps = require('ps');

ps('-a; touch PoC', (error, stdout) => {
    console.log(stdout);
});