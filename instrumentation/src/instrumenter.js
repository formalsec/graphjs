/**
 * CLI Program that takes as an input a normalized javascript file, and a config
 * file and returns the instrumented symbolic test to be executed with
 * a symboilic javascript code executor.
 */


/**
 * Requires
 */
const yargs = require("yargs");
const fs = require("fs");
const astUtils = require("../utils/js_ast_generation/ast_utils");
const generate_test = require("./test_gen");
const optim = require("./optim");
const utils = require('../utils/utils');
const clone = require('lodash.clonedeep');

/**
 * Command line interface
 */
const argv = yargs
	.option("input", {
		alias: "i",
		description: "JS input file",
		demandOption: true,
		type: "string"
	})
	.option("config", {
		alias: "c",
		description: "JSON specification of sinks, source function and variable types",
		demandOption: true,
		type: "string"
	})
	.option("optim", {
		alias: "opt",
		description: "JSON specification of computation path"
	})
	.option("output", {
		alias: "o",
		description: "ECMA-SL output file",
		type: "string",
	})
	.usage("Usage: $0 -i [filepath]")
	.help()
	.alias("help", "h").argv;


/**************     Step 1 - parse the program and the types     **************/

try {
	var data = fs.readFileSync(argv.input, "utf-8");
	var ast = astUtils.js2ast(data);
	data = fs.readFileSync(argv.config, "utf-8");
	var config = JSON.parse(data);
	if (argv.optim) {
		data = fs.readFileSync(argv.optim, "utf-8");
		optim = JSON.parse(data);
	}
} catch (ex) {
	console.log(ex.toString())
}

/*****************       Step 2 (optional) optimization       *****************/

/* TODO (Optimization) -> Remove all pieces of code not executed in the assert/
 * console.log computation path
*/
if (argv.optim && config.lines) {
	ast = optim(ast, config.lines);
}

/******************      Step 3 - Generate specific test      *****************/
for (let i = 0; i < config.length; i++){

	/********************* Step 4 - Types Cartesian Product ********************/
	const subTaintSummaries = utils.generateCartesianProduct(config[i]["params_types"])
	for (let j = 0; j < subTaintSummaries.length; j++) {
		config[i]["params_types"] = subTaintSummaries[j]
		let test = generate_test(clone(ast), config[i]);

		/********************* Step 5 - output ********************/
		if (argv.output) {
			let filename = argv.output.replace(/\.[^.]+$/, `_${i}_${j}.js`);
			fs.writeFile(filename, test, err => {
				if (err) {
					console.error(err);
					return;
				}
			})
		} else {
			console.log(`-------- Symbolic Test for vulnerability ${i}.${j} --------`);
			console.log(test)
		}
	}
}
