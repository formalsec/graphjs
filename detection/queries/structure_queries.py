import os
import json

from queries.query_type import get_obj_recon_queries, assign_types

THIS_SCRIPT_NAME: str = os.path.basename(__file__)


def function_is_object_prop(obj_id):
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


def get_outer_context(obj_id):
    return f"""
        MATCH
            (source)-[def:FD]->(fn_def)
                -[path:CFG*1..]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def get_stack_single_pattern(obj_id):
    return f"""
        MATCH
            (source)-[def:FD]->(fn_def)
                -[path:CFG*1..]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def get_source(session, sink_obj, sink_location, sink_line, vuln_type, config):
    # Find first level
    fn_node = session.run(get_stack_single_pattern(sink_obj.id)).single()
    if not fn_node:
        print("Unable to detect source function")
        return "-"
    # Try to find outer contexts
    contexts = [fn_node["node"]]
    while True:
        fn_node = session.run(get_outer_context(fn_node["node"]["Id"])).single()
        if fn_node is not None:
            contexts.append(fn_node["node"])
        else:
            break

    # Check if function is a property of an object
    object_prop = session.run(function_is_object_prop(contexts[-1]["Id"])).single()
    if object_prop:
        obj_name = object_prop["obj.IdentifierName"].split(".")[1].split("-")[0]
        obj_prop = object_prop["so.IdentifierName"]
        if obj_name == "module" and obj_prop == "exports":
            fn_name = object_prop["dep.IdentifierName"]
            return create_reconstructed_exported_fn(
                session,
                sink_obj,
                sink_location,
                sink_line,
                contexts[-1],
                fn_name,
                vuln_type,
                config)
        else:
            return create_reconstructed_object_exported_prop(
                session,
                sink_obj,
                sink_location,
                sink_line,
                contexts[-1],
                obj_prop,
                vuln_type,
                config)
    else:
        return "Module not exported as expected."


# Methods responsible for reconstructing each type of sink


# VFunExported
def create_reconstructed_exported_fn(session, sink_obj, sink_location, sink_line_content, fn_node, fn_name, vuln_type, config):
    source_line = json.loads(fn_node["Location"])["start"]["line"]
    sink_line = sink_location["start"]["line"]
    tainted_params, params_types = reconstruct_param_types(session, fn_node["Id"], config)
    return {
        "vuln_type": vuln_type,
        "source": fn_name,
        "source_lineno": source_line,
        "sink": sink_line_content,
        "sink_lineno": sink_line,
        "type": "VFunExported",
        "tainted_params": tainted_params,
        "params_types": params_types
    }


# VFunPropOfExportedObj
def create_reconstructed_object_exported_prop(session, sink_obj, sink_location, sink_line_content, fn_node, prop_name, vuln_type, config):
    source_line = json.loads(fn_node["Location"])["start"]["line"]
    sink_line = sink_location["start"]["line"]
    tainted_params, params_types = reconstruct_param_types(session, fn_node["Id"], config)
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
