/**
 * Library to generate a specific symbolic test from a test template and a
 * config file
 */

/**
 * Require
 */
const var_gen = require("../utils/variable_name_gen");
const { js2ast, ast2js } = require("../utils/js_ast_generation/ast_utils");
const map_reduceJS = require("../utils/js_ast_manipulation/js_map_reduce");
const mapJS = require("../utils/js_ast_manipulation/js_mapper");
const format_pretty = require("../utils/format_pretty");
const instr_const = require("../constants/instr_constants");
const utils = require("../utils/utils");

/**
 * Auxiliary functions
 */

/**
 * This function receives a program and a list of sink types and returns the
 * list of variables which have been used in the normalization instead of the
 * ones that are member expressions
 * @param {Object} ast
 * Esprima AST representation of a JavaScript program
 * @param {String[]} sink_types
 * Array of types of sinks
 * @returns
 *
 */
function get_additional_sinks(ast, sinks) {
  function f(p) {
    try {
      switch (p.type) {
        case "VariableDeclarator":
          // var <var> = <obj>
          if (p.init.type === "Identifier" && sinks === ast2js(p.init)) {
            return [p.id.name];
          }
          // car <var> = <obj>.<prop>
          else if (p.init.type === "MemberExpression" && sinks === ast2js(p.init)) {
            return [p.id.name];
          }
          else {
            return [];
          }
        default:
          return [];
      }
    } catch (e) {
      console.log("get_mem_exp_sink_vars: parameter is not an AST.");
    }
  }
  return map_reduceJS(f, (d, ac) => d.concat(ac), ast, []);
}

let fresh_symb_var = var_gen.fresh_symb_var_gen();
let fresh_obj_var = var_gen.fresh_obj_var_gen();
let fresh_obj_prop_var = var_gen.fresh_obj_prop_var_gen();
let fresh_array_var = var_gen.fresh_array_var_gen();
let fresh_symb_obj_var = var_gen.fresh_symb_obj_var_gen();
let fresh_symb_prop_var = var_gen.fresh_symb_prop_var_gen();
let fresh_symb_num_var = var_gen.fresh_symb_num_var_gen();
let fresh_symb_str_var = var_gen.fresh_symb_str_var_gen();
let fresh_symb_bool_var = var_gen.fresh_symb_bool_var_gen();
let fresh_symb_func_var = var_gen.fresh_symb_func_var_gen();
let fresh_concrete_var = var_gen.fresh_concrete_var_gen();
let fresh_test_var = var_gen.fresh_test_var_gen();

function is_symb_name(name) {
  return name === '*'
}

/**
 * Main functions
 */
/**

/**
 * Instrument vulnerable function code
 * @param {Object} ast
 * Esprima AST representation of JavaScript code
 * @param {Object} stmt
 * Esprima AST statement
 */
function instrument_code(ast, stmt) {
  var arg_check = "";
  stmt.forEach((argument) => {
    let test_var = fresh_test_var();
    arg_check += "const " + test_var + " = !is_symbolic(" + ast2js(argument) + ");\n" + "Assert(" + test_var + ");\n";
  })
  return js2ast("{\n" + arg_check + ast2js(ast) + "};");
}

/**
 * Remove module.exports and add a test before each vulnerable sink to see if
 * input is safe (i.e. not symbolic)
 * @param {Object} ast_prog
 * Esprima AST representation of JavaScript code
 * @param {Object} sink
 * Unsafe sink name
 */
const util = require('util')

function module_exp_rm_sink_safeguard(ast_prog, sink, sink_lineno) {
  // console.log(util.inspect(ast_prog, {depth: null}));

  function f(ast) {
    switch (ast.type) {
      case "VariableDeclaration":
        if (ast.declarations[0].init && ast.declarations[0].init.type === "CallExpression" && ast.declarations[0].init.callee.type === "MemberExpression" && ast.loc.start.line === sink_lineno) {
          /* var <var> = <package>.<sink>(<var>) */
          ast.declarations[0].init.callee.object.name = "esl_symbolic"
          ast.declarations[0].init.callee.property.name = `${ast.declarations[0].init.callee.property.name}Wrapper`
        }
        else if (ast.declarations[0].init && (ast.declarations[0].init.type === "CallExpression" || ast.declarations[0].init.type === "NewExpression")
          && ast.loc.start.line === sink_lineno) {
          /* let <var> = <sink>(<var>) */
          ast.declarations[0].init.callee.name = `esl_symbolic.${ast.declarations[0].init.callee.name}Wrapper`
        }
        return null;
      case "ExpressionStatement":
        /* Remove module.exports = {} */
        if (ast.expression.type === "AssignmentExpression" && ast2js(ast.expression.left) === "module.exports") {
          return { type: "EmptyStatement" };
        } else if (ast.expression.type === "AssignmentExpression" && ast.expression.right.type === "CallExpression"
          && ast.expression.right.callee.object && ast.expression.right.callee.object && ast.loc.start.line === sink_lineno) {
          /*<package>.<sink>(<var>) */
          ast.expression.right.callee.object.name = "esl_symbolic"
          ast.expression.right.callee.property.name = `${ast.expression.right.callee.property.name}Wrapper`
        } else if (ast.expression.type === "AssignmentExpression" && ast.expression.right.type === "CallExpression"
          && ast.loc.start.line === sink_lineno) {
          /*<sink>(<var>) */
          ast.expression.right.callee.name = `esl_symbolic.${ast.expression.right.callee.name}Wrapper`
        }
        return null;
      default:
        return null;
    }
  };
  return mapJS(f, ast_prog);
}


// TODO: Update docs

/**
 * Receives a function parameter object and returns the string corresponding to
 * the declaration of that parameter as a symbolic variable of the specified
 * type (in case of concrete, declares to the value)
 * @param {String} param_name
 * Parameter name
 * @param {Object} param_type
 * Parameter type, i.e, object structure and types
 * @param {Object} var_info
 * Information about a variable
 * @returns {Object}
 * Variable assignment
 */
function generate_symb_assignment({
  param_name,
  param_type,
  prefix = "",
  vuln_type,
  is_prop = false,
  is_symb_prop = false,
  is_array_el = false
}) {
  var name = prefix + param_name;
  var prefix = name + "__";
  if ((typeof param_type === 'object'
    && !Array.isArray(param_type) && param_type !== null)) {
    name += `___${fresh_obj_var()}`;

    /* Generate properties assignment */
    var props_assign = Object.entries(param_type)
      .reduce((acc, [p_name, p_type]) => {
        if (!is_symb_name(p_name))
          acc.concr.push(generate_symb_assignment({ param_name: p_name, param_type: p_type, prefix: prefix, vuln_type: vuln_type, is_prop: true }));
        else {
          /* Generate the symbolic property name */
          acc.symb.push({ name: fresh_symb_prop_var(), type: p_type });
        }
        return acc;
      }, { concr: [], symb: [] });

    /* Generate the symbolic info */
    props_assign.symb = props_assign.symb.map((p) => {
      /* The symbolic property is not any of the other properties */
      var assumes = props_assign.concr.map((el) =>
        `esl_symbolic.assume(${prefix + p.name} != "${el.name}");\n`);
      props_assign.symb.forEach((el) => {
        if (p.name != el.name) {
          assumes.push(`esl_symbolic.assume(${prefix + p.name} != ${el.name});\n`);
        }
      });
      var symb_assigns = generate_symb_assignment({ param_name: p.name, param_type: p.type, prefix: prefix, vuln_type: vuln_type, is_prop: true, is_symb_prop: true });
      /* Info to generate the symbolic assignments:
        name: fresh symbolic property name
        tmplt: template of the object's concrete properties assignments
        remaining_assignments: list of the remaining assignments to generate
        assumes: the symbolic property is not any of the other properties
        decl_target: stack of declarations of the object. Traverse in reverse to generate the assignment
      */
      var remaining_assignments = [];
      if (symb_assigns.remaining_assignments) {
        remaining_assignments = symb_assigns.remaining_assignments;
      }
      return { name: prefix + p.name, obj_name: symb_assigns.name, tmplt: symb_assigns.tmplt, remaining_assignments: remaining_assignments, assumes: assumes, decl_target: name };
    });

    /* Generate the object template */
    var object_tmplt = `var ${name} = {\n`
    if (is_prop && !is_symb_prop)
      var object_tmplt = `${name}: {\n`
    else if (is_array_el)
      var object_tmplt = `{\n`

    object_tmplt += utils.indent(props_assign.concr.map((p) => p.tmplt).join(',\n'))

    if (!is_prop || is_symb_prop)
      object_tmplt += `\n};\n`
    else
      object_tmplt += `\n}`

    var remaining_assignments = [].concat(
      props_assign.symb.map((p) => p.remaining_assignments).flat(),
      props_assign.symb.map((p) => {
        delete p.remaining_assignments;
        return p;
      }),
      props_assign.concr.map((p) => p.remaining_assignments).filter((p) => p)
    );

    var complete_template = object_tmplt;

    if (!is_prop) { // Object is not a property, generate all the remaining assignments
      var concrete_tmplt = remaining_assignments.map((a) => a.tmplt).join('');
      var symb_props_tmplt = remaining_assignments.map((a) =>
        `var ${a.name} = esl_symbolic.string("${a.name}");\n`).join('');
      var assumes = remaining_assignments.map((a) => a.assumes).join('');
      var assignments = remaining_assignments.map((a) =>
        `${a.decl_target}[${a.name}] = ${a.obj_name};\n`).join('');
      /* Update the complete template */
      complete_template = symb_props_tmplt + assumes + object_tmplt + concrete_tmplt + assignments;
      remaining_assignments = [];
    }

    return { name: name, tmplt: complete_template, remaining_assignments: remaining_assignments };

  } else if (Array.isArray(param_type) || param_type === "array") {
    name += `___${fresh_array_var()}`;
    var tmplt = `var ${name} = [\n`;
    if (is_prop && !is_symb_prop)
      tmplt = `${name}: [\n`;
    else if (is_array_el)
      tmplt = `[\n`;
    param_type = utils.fillArrayUntilLength(param_type, "string", instr_const.symb_array_length)
    var elements = [];
    for (i = 0; i < instr_const.symb_array_length; i++) {
      elements.push(generate_symb_assignment({ param_name: i, param_type: param_type[i], prefix: prefix, vuln_type: vuln_type, is_array_el: true }));
    }
    tmplt += utils.indent(elements.map((e) => e.tmplt).join(',\n'));
    if (!is_prop || is_symb_prop)
      tmplt += `\n];\n`
    else
      tmplt += `\n]`
    return { name: name, tmplt: tmplt }

  }
  else {
    switch (param_type) {
      case "any":
        name += `___${fresh_symb_var()}`;
        var tmplt = `var ${name} = esl_symbolic.any("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.any("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.any("${name}")`;
        return { name: name, tmplt: tmplt };

      case "bool":
      case "boolean":
        name += `___${fresh_symb_bool_var()}`;
        var tmplt = `var ${name} = esl_symbolic.boolean("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.boolean("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.boolean("${name}")`;
        return { name: name, tmplt: tmplt };

      case "function":
        name += `___${fresh_symb_func_var()}`;
        var tmplt = `var ${name} = esl_symbolic.function("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.function("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.function("${name}")`;
        return { name: name, tmplt: tmplt };

      case "object":
        name += `___${fresh_symb_obj_var()}`;
        var tmplt = `var ${name} = esl_symbolic.object("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.object("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.object("${name}")`;
        return { name: name, tmplt: tmplt };

      case "number":
        name += `___${fresh_symb_num_var()}`;
        var tmplt = `var ${name} = esl_symbolic.number("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.number("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.number("${name}")`;
        return { name: name, tmplt: tmplt };

      case "string":
        name += `___${fresh_symb_str_var()}`;
        var tmplt = `var ${name} = esl_symbolic.string("${name}");\n`;
        if (is_prop && !is_symb_prop)
          tmplt = `${name}: esl_symbolic.string("${name}")`;
        else if (is_array_el)
          tmplt = `esl_symbolic.string("${name}")`;
        return { name: name, tmplt: tmplt };

      case "concrete":
        name += `___${fresh_concrete_var()}`;
        var tmplt;
        if (var_info.value) {
          tmplt = `var ${name} = ${var_info.value};\n`;
          if (is_prop && !is_symb_prop)
            tmplt = `${name}: ${var_info.value}`;
          else if (is_array_el)
            tmplt = `${var_info.value}`;
        } else {
          tmplt = `var ${name};\n`
          if (is_prop && !is_symb_prop)
            tmplt = `${name}: undefined`;
          else if (is_array_el)
            tmplt = ` `;
        }
        return { name: name, tmplt: tmplt };

      default:
        throw new Error("Unsupported: generate_symb_assignment")
      // name += `_${fresh_symb_var()}`;
      // var tmplt = `var ${name} = esl_symbolic.string("${name}");\n`; // simplification purposes
      // return {name: name, tmplt: tmplt};
    }
  }
}

function get_complete_source(prog, sink) {
  var sink_assignment = prog.match(`[^ \t\r\n\f]* = ${sink}`);
  if (sink_assignment) {
    return sink_assignment[0].split('=')[0].trim();
  }
  return sink;
}

/**
 * Generates a symbolic test from a normalized source file and a config. Removes
 * the module.exports, adds a safeguard for each sink, declares the used
 * variables and calls the function with the variables
 * @param {Object} config
 * @param {Object} prog
 * Esprima AST program
 * @returns
 * A symbolic test in JavaScript string format
 */
function generate_test(prog, config) {
  /* Remove module.exports and check if sink type is symbolic */
  var parsed_prog = ast2js(format_pretty(js2ast(ast2js(module_exp_rm_sink_safeguard(prog, config.sink, config.sink_lineno)))));
  /* Add definitions and assignments of the variables needed for the program */
  var assignments = Object.entries(config.params_types)
    .map(([param, param_type]) =>
      generate_symb_assignment({
        param_name: param,
        param_type: param_type,
        vuln_type: config.vuln_type
      }));
  /* Get function parameter names */
  var param_names = assignments.map(e => e.name);
  /* Get assignment strings of symbolic variables and objects */
  var assignment_templates = assignments.map(e => e.tmplt).join('\n\n');
  /* Parse the function call with the parameter names */
  let source = get_complete_source(parsed_prog, config.source);
  var func_call = `${source}(${param_names.join(", ")});\n`;
  /** Assignments + Program + Function Call */
  return "const esl_symbolic = require('esl_symbolic');\n" +
    assignment_templates + '\n\n' + parsed_prog + '\n\n' + func_call;
}

module.exports = generate_test;
