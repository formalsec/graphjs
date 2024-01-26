import os

from queries.query_type import get_obj_recon_queries, assign_types

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


# This query checks if the function identified with node <obj_id> is exported (directly or via a property)
def function_is_exported(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
        WHERE dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND ref.RelationType = "obj"
        RETURN distinct obj.IdentifierName, so.IdentifierName, dep.IdentifierName
    """


# This query checks if the function identified with node <obj_id> is returned by another function
def function_is_returned(obj_id):
    print(obj_id)
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]
                ->(obj:PDG_OBJECT)
                    <-[ret:REF]-(fn_node)
        RETURN distinct fn_node
    """


# This query checks if the function identified with node <obj_id> is called by another function
# Due to JavaScript allowing functions to be used as arguments of another functions (which will call them internally),
# this query also checks if the function is used as an argument of a function call
# Detected cases: then() in promises
def function_is_called(obj_id):
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
                            <-[obj:REF {{RelationType: "obj"}}]-({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


# This query returns the parent function of the function/node identified with <obj_id>
def get_parent_function(obj_id):
    return f"""
        MATCH
            (source)-[def:FD]->(fn_def)
                 -[path:CFG*1..]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def add_to_exported_fns(session, exported_fn, fn_id, sink_lineno, source_lineno, sink_name, vuln_type, config):
    obj_name = exported_fn["obj.IdentifierName"].split(".")[1].split("-")[0]
    obj_prop = exported_fn["so.IdentifierName"]

    # Check if function is directly exported
    if obj_name == "module" and obj_prop == "exports":
        return create_reconstructed_exported_fn(
            session,
            sink_lineno,
            source_lineno,
            sink_name,
            fn_id,
            vuln_type,
            config)
    # Otherwise, it is a property of an exported object
    else:
        return create_reconstructed_object_exported_prop(
            session,
            sink_lineno,
            source_lineno,
            sink_name,
            fn_id,
            obj_prop,
            vuln_type,
            config)


# This function gets the source function of the node sink_obj.
def get_source(session, sink_obj, sink_lineno, source_lineno, sink_name, vuln_type, config):
    # Find first level
    fn_node = session.run(get_parent_function(sink_obj.id)).single()
    if not fn_node:
        print("Unable to detect source function")
        return "-"

    # contexts is an array of contexts (possible chains of functions)
    contexts = [[fn_node["node"]]]
    exported_fns = []
    # Try to find outer contexts
    # Process different lists of contexts
    while len(contexts) > 0:
        context = contexts.pop()
        # Check if function is exported (directly or via an object property)
        exported_fn = session.run(function_is_exported(context[-1].id)).single()
        if exported_fn:
            print(f"Function {context[-1]['IdentifierName']} is exported.")
            exported_fn = add_to_exported_fns(session, exported_fn, context[-1].id, sink_lineno, source_lineno,
                                              sink_name, vuln_type, config)
            exported_fns.append(exported_fn)
        # If the function is not exported, it is a method of an exported function (instead of object) or it is a return
        # of function. This may have different levels,
        # e.g., a function returns a function that returns a function (2 levels)
        else:
            print(f"Function {context[-1]['IdentifierName']} is not exported.")
            callee_nodes = session.run(function_is_called(context[-1].id)).peek()
            return_nodes = session.run(function_is_returned(context[-1].id)).peek()

            if callee_nodes is None and return_nodes is None:
                print("Error", context)
                exported_fns.append("Module not exported as expected.")
                break

            # Check if function is called by another function
            if callee_nodes is not None:
                # add to context and add to back of queue
                for callee_node in callee_nodes:
                    print("Is called by: ", callee_node["IdentifierName"])
                    context.append(callee_node)
                    contexts.append(context)

            # Check if function is returned by another function
            if return_nodes is not None:
                # add to context and add to back of queue
                for return_node in return_nodes:
                    print("Is returned by: ", return_node["Id"])
                    context.append(return_node)
                    contexts.append(context)
    return exported_fns


def create_context_obj(obj_id, sink_line, source_line, _type):
    return {
        id: obj_id,
        sink_line: sink_line,
        source_line: source_line,
        _type: _type
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

    print(f'[INFO][{THIS_SCRIPT_NAME}] - Assigning types to attacker-controlled data.')
    assign_types(session, params_types, config)

    return list(params_types.keys()), params_types
