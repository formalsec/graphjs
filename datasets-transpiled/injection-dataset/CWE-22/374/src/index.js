// var a=require("./demo.js");
// a.fun();
// console.log(a.funs)
var http = require("http");
var fs = require("fs");
http.createServer(function (request, response) {
    var path = "./" + request.url;
    // console.log(request.url)
    // response.end("end");
    fs.readFile(path, function (error, data) {
        if (error) {
            response.end("this url is not found");
        } else {
            response.end(data);
        }
    });
}).listen("8888");