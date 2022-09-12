/**
 * CLI program to generate an Esprima AST json file from a JavaScript program 
 */

/**
 * Require
 */
const esprima = require("esprima-next");
const yargs = require("yargs");
const fs = require("fs");

/**
 * CLI
 */
const argv = yargs
	.option("input", { alias: "i", description: "JS input file", type: "string" })
	.option("output", {
		alias: "o",
		description: "ECMA-SL output file (json format)",
		type: "string",
	})
	.demandOption("input")
	.check((argv, options) => {
		if (argv.input.substr(-3) === ".js" && argv.output.substr(-5) === ".json") {
			return true;
		}
		else {
			throw new Error("Incorrect input or output file extensions (.js and .json respectively");
		}
	})
	.usage("Usage: $0 -i [filepath]")
	.help()
	.alias("help", "h").argv;

/**
 * The function receives a JavaScript program as a string as imput and returns
 * the corresponding AST object
 * @param {String} data 
 * @returns an esprima AST object with line locations
 */
function js2ast(data) {
	return esprima.parseScript(data, {loc: true});
}

/**
 * Read input, generate output. Save to a file if the option was provided in the
 * CLI and print into the terminal otherwise
 */
fs.readFile(argv.input, "utf-8", (err, data) => {
	if (err) throw err;
	try {
		let progObj = js2ast(data);
		if(argv.output) {
			fs.writeFile(argv.output, JSON.stringify(progObj, null, 2), err => {
				if(err) {
					console.error(err);
					return;
				}
			})
		} else {
			console.log(progObj)
		}
	} catch (ex) {
		console.log(ex.toString());
	}
})