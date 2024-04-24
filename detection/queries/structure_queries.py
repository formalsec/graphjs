import json
from .query_type import get_obj_recon_queries, assign_types
from typing import TypedDict, Optional, NotRequired


class CallType(TypedDict):
    type: Optional[str]
    prop: NotRequired[str]
    fn_name: Optional[str]
    fn_id: int


class Function(TypedDict):
    id: int
    name: str


class FunctionArgs(TypedDict):
    name: str
    args: object


def check_if_function_is_directly_exported(obj_id):
    return f"""
        // Get function pattern
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND so.IdentifierName = "exports"
        AND obj.IdentifierName CONTAINS "module"
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name,
        fn_obj.IdentifierName as fn_node_id
    """


def check_if_function_is_property_exported(obj_id):
    return f"""
        // Match function pattern
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        // Match property exported pattern
        MATCH
            (obj)-[exp_dep:PDG]->(exports_prop:PDG_OBJECT)
                <-[exp_so:PDG]-(exports_obj:PDG_OBJECT)
        WHERE exp_so.IdentifierName = "exports"
        AND exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        OPTIONAL MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        OPTIONAL MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id
        """


def check_if_function_is_direct_call(obj_id):
    return f"""
        // Get function pattern
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        RETURN distinct obj.IdentifierName as fn_node_id
    """


def check_if_function_is_property_call(obj_id):
    return f"""
        // Match function pattern
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[nv:PDG]-(parent_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND nv.RelationType = "NV"
        // Get the AST origin node of the exported function (to get the location and Id)
        OPTIONAL MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        OPTIONAL MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id
        """


def get_function_identifier(fn_id):
    return f"""
        MATCH
            ({{Id: "{fn_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        RETURN distinct fn_obj.IdentifierName as id
    """


# This query checks if the function identified with node <obj_id> is returned
# by another function
def function_is_returned(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]
                ->(obj:PDG_OBJECT)
                    <-[ret:REF]-(node)
        RETURN distinct node 
    """


# This query checks if the function identified with node <obj_id> is called by
# another function.
# Due to JavaScript allowing functions to be used as arguments of another
# functions (which will call them internally), this query also checks if the
# function is used as an argument of a function call
# Detected cases: then() in promises
def function_is_called(obj_id):
    print("obj_id", obj_id)
    return f"""
        MATCH
            (source)-[def:FD]->(fn_def)
                 -[path:CFG*1..]->()
                    -[:CG*1]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
        UNION
        MATCH
            (source)-[def:FD]->(fn_def)
                 -[path:CFG*1..]->()
                    -[ref:REF*0..1]->(fn_obj:PDG_OBJECT)
                        <-[dep:PDG {{RelationType: "DEP"}}]-()
                            <-[obj:REF {{RelationType: "obj"}}]
                            -({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


# This query returns the parent function of the function/node identified
# with <obj_id>
def get_parent_function(obj_id):
    return f"""
        MATCH
            (source)-[def:FD]->(fn_def)
                 -[path:CFG*1..]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def extend_call_path(call_path_list: list[list[CallType]], new_call: CallType) -> list[list[CallType]]:
    extended_call_path_list = []
    for call_path in call_path_list:
        call_path.append(new_call)
        extended_call_path_list.append(call_path)
    return extended_call_path_list


# This function checks if the function given as argument is exported (either
# directly, via new, or via a method).
def get_exported_type(session, function_id: int) -> Optional[list[CallType]]:
    direct_function = session.run(check_if_function_is_directly_exported(function_id)).single()
    if direct_function is not None:
        return [{'type': 'Call', 'fn_name': direct_function["fn_node_id"], 'fn_id': function_id}]
    property_function = session.run(check_if_function_is_property_exported(function_id)).single()
    if property_function is not None:
        if not property_function["is_function"]:
            return [{'type': 'Method', 'prop': property_function["prop_name"], 'fn_name': property_function["fn_node_id"], 'fn_id': function_id}]
        else:
            return [
                {'type': 'New', 'fn_name': property_function["obj_name"], 'fn_id': property_function["source_obj_id"]},
                {'type': 'Method', 'prop': property_function["prop_name"], 'fn_name': property_function["fn_node_id"], 'fn_id': function_id}]

    return None


def get_return_type(session, function_id: int) -> Optional[CallType]:
    direct_function = session.run(check_if_function_is_direct_call(function_id)).single()
    if direct_function is not None:
        return {'type': 'Call', 'fn_name': direct_function["fn_node_id"], 'fn_id': function_id}
    property_function = session.run(check_if_function_is_property_call(function_id)).single()
    if property_function is not None:
        if not property_function["is_function"]:
            return {'type': 'Method', 'prop': property_function["prop_name"], 'fn_name': property_function["fn_node_id"],
                 'fn_id': function_id}
        else:
            return {'type': 'New', 'fn_name': property_function["obj_name"], 'fn_id': property_function["source_obj_id"]}

    return None


# This function returns the functions that call a function given as argument
def find_callers(session, function_id: int) -> list[Function]:
    return [{'id': int(fn["node"]["Id"]), 'name': fn["node"]["IdentifierName"]}
            for fn in session.run(function_is_called(function_id))]


# This function returns the functions that return a function given as argument
def find_returners(session, function_id: int) -> list[Function]:
    return [{'id': int(fn["node"]["Id"]), 'name': fn["node"]["IdentifierName"]}
            for fn in session.run(function_is_returned(function_id))]


# This function returns the call path from an exported function to the sink
def find_call_path(session, function_id: int) -> list[list[CallType]]:
    # Get function type
    fn_type: Optional[list[CallType]] = get_exported_type(session, function_id)
    print(fn_type)
    # If function is exported, return the exported type
    if fn_type is not None:
        return [fn_type]
    else:
        call_paths: list[list[CallType]] = []
        # Get functions that call the current function (replace in call path)
        callers: list[Function] = find_callers(session, function_id)
        print("Callers: ", callers)
        for caller in callers:
            cur_call_paths = find_call_path(session, caller['id'])
            call_paths += cur_call_paths

        # Get functions that return the current function (extend call path)
        returners: list[Function] = find_returners(session, function_id)
        print("Returners: ", returners)
        for returner in returners:
            cur_call_paths = find_call_path(session, returner['id'])
            # For returns, we need to know the type (to extend)
            return_type: CallType = get_return_type(session, function_id)
            cur_call_paths = extend_call_path(cur_call_paths, return_type)
            call_paths += cur_call_paths
    return call_paths


# This functions returns a structure that maps the function names contained
# in all call paths to its arguments and types
def get_function_args(session, call_paths: list[list[CallType]], config):
    function_map: dict[FunctionArgs] = {}
    for call_path in call_paths:
        for call in call_path:
            tainted_params, params_types = reconstruct_param_types(session,
                                                                   call["fn_id"],
                                                                   config)
            function_map[call["fn_name"]] = params_types
    return function_map


# This function creates the exploit template
# Gets the vulnerable call paths, and returns an auxiliary structure that maps
# function names to its arguments and types
def make_exploit_template(session, function_id: int, sink_lineno, sink_line_content, vuln_type, config):
    # Find first level
    fn_node = session.run(get_parent_function(function_id)).single()
    if not fn_node:
        print("Unable to detect source function")
        return

    call_paths: list[list[CallType]] = find_call_path(session, fn_node["node"]["Id"])
    print(call_paths)
    function_args = get_function_args(session, call_paths, config)

    return {
        "vuln_type": vuln_type,
        "sink": sink_line_content,
        "sink_lineno": sink_lineno,
        "call_paths": call_paths,
        "function_args": function_args
    }


# This function gets the source object of the node sink_obj
def get_source(session, sink_obj, sink_lineno, source_lineno, sink_name, vuln_type, config):
    # Find first level
    fn_node = session.run(get_parent_function(sink_obj.id)).single()
    if not fn_node:
        print("Unable to detect source function")
        return

    call_paths = make_exploit_template(session, sink_obj.id, sink_lineno, sink_name, vuln_type, config)
    print(json.dumps(call_paths, indent=4))
    return [call_paths]

    # Contexts is an array of contexts (possible chains of functions)
    # The first context is the base context (parent function of the sink)
    contexts = [[create_context_obj(fn_node["node"], "base")]]
    exported_fns = []  # This variable stores the exported functions

    # Try to find outer contexts (go outwards until is exported)
    while len(contexts) > 0:
        # Get next possible context list
        context = contexts.pop()
        # Check if function is exported (directly or via an object property)
        exported_fn = session.run(function_is_exported(context[0]['id'])).single()
        if exported_fn:
            source_lineno = json.loads(exported_fn["source"] or exported_fn["source_obj"])["start"]["line"]
            exported_fn = add_to_exported_fns(session, exported_fn, context, sink_lineno, source_lineno,
                                              sink_name, vuln_type, config)
            exported_fns.append(exported_fn)
        # If the function is not exported, it is a method of an exported function (instead of object) or it is a return
        # of function. This may have different levels,
        # e.g., a function returns a function that returns a function (2 levels)
        else:
            callee_nodes = session.run(function_is_called(context[0]['id'])).peek()
            return_nodes = session.run(function_is_returned(context[0]['id'])).peek()

            if callee_nodes is None and return_nodes is None:
                print("Error", context)
                exported_fns.append("Module not exported as expected.")
                break

            # If function is called by another function, replace last context with callee
            if callee_nodes is not None:
                for callee_node in callee_nodes:
                    context[0] = create_context_obj(callee_node, "calls")
                    contexts.append(context)

            # If function is returned by another function, add parent function to the context stack
            if return_nodes is not None:
                # add to context and add to back of queue
                for return_node in return_nodes:
                    context.insert(0, create_context_obj(return_node, "returns"))
                    contexts.append(context)
    return exported_fns


# This function reconstructs the exported function
# (takes into consideration returns and calls)
def add_to_exported_fns(session, exported_fn, contexts, sink_lineno,
                        source_lineno, sink_name, vuln_type, config):
    obj_name = exported_fn["obj.IdentifierName"].split(".")[1].split("-")[0]
    obj_prop = exported_fn["so.IdentifierName"]

    # First, the entrypoint is the exported function/property of an
    # exported object (last context)
    last_context = contexts[0]
    if obj_name == "module" and obj_prop == "exports":
        entrypoint = create_reconstructed_exported_fn(session, sink_lineno,
                                                      source_lineno, sink_name,
                                                      last_context["id"],
                                                      vuln_type, config)
    else:
        entrypoint = create_reconstructed_object_exported_prop(
            session, sink_lineno, source_lineno, sink_name,
            last_context["id"], obj_prop, vuln_type, config)

    if len(contexts) == 1:
        return entrypoint

    # If the context type is "returns", the last context object gains a new
    # property "returns" with the next element
    # Currently, it only supports one return level but is easily expandable
    if contexts[0]["_type"] == "returns":
        entrypoint["returns"] = create_reconstructed_base(session,
                                                          contexts[1]["id"],
                                                          contexts[1]["name"],
                                                          config)
        entrypoint["type"] = "VFunRetByExport"
    return entrypoint


def create_context_obj(fn_node, _type):
    return {
        "id": fn_node["Id"],
        "name": fn_node["IdentifierName"],
        "_type": _type
    }


# Methods responsible for reconstructing each type of sink

# 1. VFunExported
def create_reconstructed_exported_fn(session, sink_line, source_line, sink_line_content, fn_id, vuln_type, config):
    tainted_params, params_types = reconstruct_param_types(session, fn_id, config)
    return {
        "vuln_type": vuln_type,
        "source": "module.exports",
        "source_lineno": source_line,
        "sink": sink_line_content,
        "sink_lineno": sink_line,
        "type": "VFunExported",
        "tainted_params": tainted_params,
        "params_types": params_types
    }


# 2. VFunPropOfExportedObj
def create_reconstructed_object_exported_prop(session, sink_line, source_line, sink_line_content, fn_id, prop_name,
                                              vuln_type, config):
    tainted_params, params_types = reconstruct_param_types(session, fn_id, config)
    return {
        "vuln_type": vuln_type,
        "source": f"module.exports.{prop_name}",
        "source_lineno": source_line,
        "sink": sink_line_content,
        "sink_lineno": sink_line,
        "type": "VFunPropOfExportedObj",
        "tainted_params": tainted_params,
        "params_types": params_types
    }


# Base
def create_reconstructed_base(session, fn_id, fn_name, config):
    tainted_params, params_types = reconstruct_param_types(session, fn_id, config)
    return {
        "source": fn_name,
        "type": "VBase",
        "tainted_params": tainted_params,
        "params_types": params_types
    }


def reconstruct_param_types(session, source_cfg_id, config):
    params_types = {}
    queries = get_obj_recon_queries(source_cfg_id)

    for query in queries:
        results = session.run(query)
        for record in results:
            param = record["param"]
            param_name = param["IdentifierName"]
            if "argv" not in param_name:
                param_name = param_name.split(".")[1].split("-")[0]
            else:
                param_name = "argv"

            if param_name == "this":
                continue

            obj_recon_flag = True
            if param_name not in params_types:
                params_types[param_name] = {
                    "pdg_node_id": {param["Id"]}
                }
            else:
                param_types_pointer = params_types
                params_types = params_types[param_name]
                for rel in record["obj_edges"]:
                    node_id = rel.nodes[1]["Id"]
                    if rel["RelationType"] == "SO" and obj_recon_flag:
                        prop_name = rel["IdentifierName"]
                        if prop_name not in params_types:
                            params_types[prop_name] = {
                                "pdg_node_id": {node_id}
                            }
                        else:
                            params_types[prop_name]["pdg_node_id"].add(node_id)
                        params_types = params_types[prop_name]
                    elif rel["RelationType"] == "DEP":
                        obj_recon_flag = False
                        params_types["pdg_node_id"].add(node_id)
                params_types = param_types_pointer

    print(f'[INFO] Assigning types to attacker-controlled data.')
    assign_types(session, params_types, config)

    return list(params_types.keys()), params_types
