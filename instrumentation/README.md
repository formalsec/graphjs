# ExplodeInst - Symbolic test instrumentation for ExplodeJS

This package serves to instrument normalized files outputted from js-cpg. It also uses the config file outputted from the same tool.

## Usage

	node ./src/instrumenter.js -i <input_file_path> -c <config_file_path> [-o <output_file_path>]

## Config constants

The file ./constants/instr_constants.js contains some constants which can be altered to change the behaviour of the program such as the length of a symbolic generated array or the generated variable names' prefixes.

## Dependencies

	> NodeJS
	> esprima-next
	> fs
	> yargs

## Folder Structure

	┌── constants 						(instrumentation constants)
	├── src 								(source code)
	└── utils
		 ├── exploit_gen 				(tool to generate exploits from JaVerT models)
		 ├── js_ast_generation 		(CLI of esprima and escodegen)
		 └── js_ast_manipulation	(AST tree manipulation utils)

## Format of Input Files

The source files must come in a format in which each logic block is assigned to a unique variable, (e.g. return eval(x+y) => var a1 = x+y; var a2 = eval(a1); return a2).

The config files specify the source function and its arguments and the sink types (e.g. eval, console.log, jquery.execute, ...). The config file might also include the executed lines for optimization (blocking unused computation paths). The types of the arguments are the next ones:

	• "concrete": Used for non-symbolic function arguments
		-> value: value of the argument
	• "bool": Used for symbolic boolean value
	• "number": Used for symbolic number
	• "string": Used for symbolic string
	• "prop_string": Used for symbolic strings exluding "valueOf", "toString", "hasOwnProperty", "constructor". Mainly used when accessing properties of objects with them
	• "array": Used for symbolic array.
		-> def_element: nameless element of one of the types specified in this list. Defines the default element to be written at each index
		-> spec_elem: list of elements which include an additional property "index" which allow to specify the structure of the elements of the array.
		-> [length]: Determines the length of the array. When undefined length is taken from the config constants.
	• "object": Used for objects. Internal structure must be specified. Use name: "symb_prop_(num)" for symbolic properties.
		-> Properties: list of properties of the object.
			* name: name of the property
			* type: elemnt of this list
			* [additional properties depending on the element type]
	• "symbolic": Try to avoid due to being computationally more complex (creates symbolic execution branching).