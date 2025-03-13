from detection.queries.interaction_protocol.parameter_types import reconstruct_param_types
from detection.queries.query import DetectionResult
from typing import TypedDict, Optional, NotRequired
import json
import re
create_server_pattern = re.compile(r'\bcreateServer\b')
listen_pattern = re.compile(r'\.listen\((\d+|"(\d+)")\)')

class Call(TypedDict):
    type: Optional[str]
    prop: NotRequired[str]
    fn_name: Optional[str]
    fn_id: int
    source_fn_id: int


class FunctionArgs(TypedDict):
    name: str
    args: object


class TaintSummaryCall(TypedDict):
    source: str
    params_types: FunctionArgs
    tainted_params: list[str]
    returns: NotRequired[dict]


# Check if the function is marked as exported
def check_if_function_is_exported(obj_id):
    return f"""
    MATCH (fn_obj {{Id: "{obj_id}"}})
    RETURN CASE WHEN fn_obj.SubType = "exported" THEN true ELSE false END AS is_exported
    """

# Check if the function is top level
def check_if_function_is_top_level(obj_id):
    return f"""
    MATCH 
        (fn_obj {{Id: "{obj_id}"}})
            <-[call:CG]-(call_obj:PDG_CALL)
                <-[call_ast:REF]-(call_obj_ast)
    WHERE call_ast.RelationType = "obj"
    MATCH
        (call_obj_ast:VariableDeclarator)
            -[init:AST]->(call_expr:CallExpression)
                -[callee:AST]->(callee_obj:Identifier)
    WHERE init.RelationType = "init"
    AND callee_obj.IdentifierName = fn_obj.IdentifierName
    MATCH
        (cfg_obj:CFG_F_START)
    WHERE 
        cfg_obj.Id = fn_obj.FunctionContext
    MATCH
        (cfg_call_obj:CFG_F_START)
    WHERE 
        cfg_call_obj.Id = call_obj.FunctionContext
    RETURN CASE WHEN cfg_obj.IdentifierName = "__main__" THEN true ELSE false END AS is_top_level, fn_obj.IdentifierName as fn_name
    """


# Function: Returns the Cypher query that checks if a function is directly exported
#   We consider a direct export if it exported as "module.exports = f" or "exports = f" TODO: the second case
#   The Cypher patterns checks if the MDG object associated with the function definition (fn_obj) is a dependency of
#   the sub object module.exports.
#   The optional matchis for the case where the exports object is defined before the function is defined
# Parameters:
#   obj_id: Function id
# Query Returns:
#   The node id of the function MDG object
def check_if_function_is_directly_exported(obj_id):
    return f"""
        // Get function pattern
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"

        OPTIONAL MATCH path = (fn_obj)<-[nv:PDG*1..]-(last_version_obj:PDG_OBJECT)
            WHERE ALL(r IN nv WHERE r.RelationType = "NV")  // Ensures all relationships in the path are NV

        WITH fn_obj, 
            CASE WHEN last_version_obj IS NOT NULL THEN last_version_obj ELSE fn_obj END AS last_fn_obj

        MATCH (last_fn_obj)-[dep:PDG]->(sub_obj:PDG_OBJECT)
                <-[so:PDG]-(obj:PDG_OBJECT)
        WHERE dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND so.IdentifierName = "exports"
        AND obj.IdentifierName CONTAINS "module"
        RETURN fn_obj.IdentifierName as fn_node_id
    """


# Function: Returns the Cypher query that checks if a function is exported via a property
#   We consider an export via property if it exported through "module.exports = { prop: fn }" or "exports.prop = fn"
#   The Cypher detection pattern is composed of 2 parts.
#       - 1 (module.exports = { prop: fn }): Checks if the MDG object associated with the function definition (fn_obj)
#       is a property of an object that is a dependency of the sub object module.exports.
#       - 2 (exports.prop = fn): Checks if the MDG object associated with the function definition (fn_obj) is a
#       dependency of object exports.
# Parameters:
#   obj_id: Function id
# Query Returns:
#


def check_if_function_is_property_exported_via_exports(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND obj.IdentifierName CONTAINS "exports"     
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
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


def check_if_function_is_property_exported_via_module(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        -[down_nv:PDG*0..]->(last_version_obj:PDG_OBJECT)
                            -[exp_dep:PDG]->(exports_prop:PDG_OBJECT)
                                <-[exp_so:PDG]-(exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND exp_so.IdentifierName = "exports"
        AND exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        OPTIONAL MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id
            
        UNION
        
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        -[down_nv:PDG*0..]->(last_version_obj:PDG_OBJECT)
                            -[dep_obj:PDG]->(exports_obj_prop:PDG_OBJECT)
                                <-[exp_obj_so:PDG]-(exports_obj:PDG_OBJECT)
                                    -[down_exp_nv:PDG*0..]->(last_version_exports_obj_prop:PDG_OBJECT)
                                        -[exp_dep:PDG]->(exports_prop:PDG_OBJECT)
                                            <-[exp_so:PDG]-(last_version_exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND ALL(edge IN down_nv WHERE edge.RelationType = "NV")
        AND dep_obj.RelationType = "DEP"
        AND exp_obj_so.RelationType = "SO"
        AND ALL(edge IN down_exp_nv WHERE edge.RelationType = "NV")
        AND exp_dep.RelationType = "DEP"
        AND exp_so.RelationType = "SO"
        AND exp_so.IdentifierName = "exports"
        AND last_version_exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
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


def check_if_function_is_property_exported_via_module_prop(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[up_nv:PDG]-(exports_prop:PDG_OBJECT)
                                <-[exp_so:PDG]-(exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND exp_so.IdentifierName = "exports"
        AND exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        OPTIONAL MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name,
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id
        UNION
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        -[dep_obj:PDG]->(exports_obj_prop:PDG_OBJECT)
                            <-[exp_obj_so:PDG]-(exports_obj:PDG_OBJECT)
                                <-[up_nv:PDG*1..]-(last_version_exports_prop:PDG_OBJECT)
                                        <-[exp_so:PDG]-(last_version_exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND dep_obj.RelationType = "DEP"
        AND exp_obj_so.RelationType = "SO"
        AND ALL(edge IN up_nv WHERE edge.RelationType = "NV")
        AND exp_so.IdentifierName = "exports"
        AND last_version_exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
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


def check_if_function_is_property_exported_via_prototype(obj_id):
    return f"""
        MATCH
        ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[proto_version:PDG]-(proto_obj:PDG_OBJECT)
                            <-[proto_so:PDG]-(proto_fn:PDG_OBJECT)
                                -[exp_dep:PDG]->(exports_prop:PDG_OBJECT)
                                    <-[exp_so:PDG]-(exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND proto_version.RelationType = "NV"
        AND proto_so.RelationType = "SO"
        AND exp_so.IdentifierName = "exports"
        AND exports_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id, null as exp_prop_name
        UNION
        MATCH
        ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[proto_version:PDG]-(proto_obj:PDG_OBJECT)
                            <-[proto_so:PDG]-(proto_fn:PDG_OBJECT)
                                -[exp_dep:PDG]->(exports_prop_dep:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND proto_version.RelationType = "NV"
        AND proto_so.RelationType = "SO"
        // module exports pattern
        MATCH
            (exports_prop_dep:PDG_OBJECT)
                <-[exp_prop_so:PDG]-(module_exports_prop_obj:PDG_OBJECT)
                    <-[exp_prop_nv:PDG]-(module_exports_obj:PDG_OBJECT)
                        <-[module_exp_so:PDG]-(module_obj:PDG_OBJECT)
        WHERE exp_prop_so.RelationType = "SO"
        AND exp_prop_nv.RelationType = "NV"
        AND module_exp_so.IdentifierName = "exports"
        AND module_obj.IdentifierName CONTAINS "module"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*1..]-(origin_version_obj_so:PDG_OBJECT)
                <-[origin_version_obj_so_edge:PDG]-(origin_version_obj:PDG_OBJECT)
                    <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        AND origin_version_obj_so_edge.RelationType = "SO"
        // Check if the object is a function or an object (to detect classes)
        MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id, exp_prop_so.IdentifierName as exp_prop_name
        UNION
        MATCH
        ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[proto_version:PDG*0..]-(proto_obj:PDG_OBJECT)
                            <-[proto_so:PDG]-(proto_fn:PDG_OBJECT)
                                -[exp_dep:PDG]->(exports_prop_dep:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP" 
        AND so.RelationType = "SO"
        AND ALL(edge IN proto_version WHERE edge.RelationType = "NV")
        AND proto_so.RelationType = "SO"
        // exports pattern
        MATCH
        (exports_prop_dep:PDG_OBJECT)
                <-[exp_prop_so:PDG]-(exports_prop_obj:PDG_OBJECT)
                    <-[exp_prop_nvs:PDG*0..]-(exports_obj:PDG_OBJECT)
        WHERE exp_prop_so.RelationType = "SO"
        AND ALL(edge IN exp_prop_nvs WHERE edge.RelationType = "NV")
        AND exports_obj.IdentifierName CONTAINS "exports"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (obj:PDG_OBJECT)<-[nv:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        MATCH
            (origin_obj_ast)-[def:FD]->(origin_obj_cfg:CFG_F_START)
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name, 
            fn_obj.IdentifierName as fn_node_id, COUNT(origin_obj_cfg) as is_function,
            origin_obj_ast.Id as source_obj_id, exp_prop_so.IdentifierName as exp_prop_name
        """


def check_if_function_is_property_exported_via_this_property(obj_id):
    return f"""
        MATCH
        ({{Id: "{obj_id}"}})-[ref:REF]->(fn_obj:PDG_OBJECT)
                -[dep:PDG]->(sub_obj:PDG_OBJECT)
                    <-[so:PDG]-(obj:PDG_OBJECT)
                        <-[this_version:PDG*1..]-(this_obj:PDG_OBJECT)
                            <-[param:REF]-(class_ast_obj)
                                -[class_obj_ref:REF]->(class_obj:PDG_OBJECT)
                                    -[exp_dep:PDG]->(exports_prop:PDG_OBJECT)
                                        <-[exp_so:PDG]-(exports_obj:PDG_OBJECT)
        WHERE ref.RelationType = "obj"
        AND dep.RelationType = "DEP"
        AND so.RelationType = "SO"
        AND ALL(edge IN this_version WHERE edge.RelationType = "NV")
        AND param.RelationType = "param"
        AND param.ParamIndex = "this"
        AND class_obj_ref.RelationType = "obj"
        AND exp_so.IdentifierName = "exports"
        AND exports_obj.IdentifierName CONTAINS "module"
        RETURN distinct class_obj.IdentifierName as obj_name, so.IdentifierName as prop_name,
            fn_obj.IdentifierName as fn_node_id, 1 as is_function,
            class_ast_obj.Id as source_obj_id
        """



# This query checks if the function identified with node <obj_id> is returned
# by another function
def function_is_returned(obj_id):
    return f"""
        // Check if function is returned as direct function
        MATCH
            (origin {{Id: "{obj_id}"}})
                -[ref:REF {{RelationType: "obj"}}]->(obj:PDG_OBJECT)
                    -[dep:PDG {{RelationType: "DEP"}}]->(ret_obj:PDG_RETURN)
                        <-[ret:REF]-(stmt_node)
                            <-[ast_path:AST*0..]-(fn_node:FunctionExpression)
                                <-[init:AST {{RelationType: "init"}}]-(node:VariableDeclarator)
        RETURN distinct obj.IdentifierName as obj_name, null as prop_name,
        obj.IdentifierName as fn_node_id, 0 as is_function, node.Id as source_obj_id
        UNION
        // Check if function is returned via property 
        MATCH
            ({{Id: "{obj_id}"}})
                -[ref:REF {{RelationType: "obj"}}]->(obj:PDG_OBJECT)
                    -[dep:PDG]->(sub_obj:PDG_OBJECT)
                        <-[so:PDG]-(fn_obj:PDG_OBJECT)
                            <-[nv:PDG]-(parent_obj:PDG_OBJECT),
            (fn_obj)-[dep_ret:PDG {{RelationType: "DEP"}}]->(ret_obj:PDG_RETURN)
                <-[ret:REF]-(stmt_node)
                    <-[ast_path:AST*0..]-(fn_node:FunctionExpression)
                        <-[init:AST {{RelationType: "init"}}]-(node:VariableDeclarator)
        WHERE so.RelationType = "SO"
        AND dep.RelationType = "DEP"
        AND nv.RelationType = "NV"
        // Get the AST origin node of the exported function (to get the location and Id)
        MATCH
            (parent_obj:PDG_OBJECT)<-[nvs:PDG*0..]-(origin_version_obj:PDG_OBJECT)
                <-[origin_obj:REF]-(origin_obj_ast)
        WHERE origin_obj.RelationType = "obj"
        // Check if the object is a function or an object (to detect classes)
        // Check if any version
        OPTIONAL MATCH
            (node)-[:PDG {{RelationType: "DEP"}}]->(class_obj:PDG_OBJECT)
                -[obj_nv:PDG*1..]->(some_class_obj)
                    -[obj_so]->(class_prop:PDG_OBJECT)
        WHERE ALL(nv IN obj_nv WHERE nv.RelationType = "NV")
        AND obj_so.RelationType = "SO"
        AND obj_so.IdentifierName = "is_class"
        RETURN distinct obj.IdentifierName as obj_name, so.IdentifierName as prop_name,
            fn_obj.IdentifierName as fn_node_id, COUNT(class_prop) as is_function,
            node.Id as source_obj_id
    """


# This query checks if the function identified with node <obj_id> is called by
# another function.
# Due to JavaScript allowing functions to be used as arguments of another
# functions (which will call them internally), this query also checks if the
# function is used as an argument of a function call
# Detected cases: then() in promises
# The last union is for the case of a call in exported functions
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
            ({{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]->(fn_obj:PDG_OBJECT)
                -[arg:PDG {{RelationType: "ARG"}}]->(call:PDG_CALL)
                    <-[stmt_ref:REF {{RelationType: "obj"}}]-(call_stmt),
            (call_stmt)<-[path:CFG*1..]-()<-[def:FD]-(source)
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
        UNION
        MATCH
            (source)-[def:FD]->(fn_def)
                 -[path:CFG*1..]->(call_stmt:VariableDeclarator)
                    -[stmt_ref:REF {{RelationType: "obj"}}]->(call_obj:PDG_CALL)
                        -[:CG*1]->({{Id: "{obj_id}"}})
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


# Function: Returns the Cypher query that checks if a function used as a promise
#   The Cypher patterns checks if the MDG object associated with the function definition (fn_obj) is a dependency of
#   an object that results from a statement that initializes a promise. TODO: Missing cases for sure
# Parameters:
#   obj_id: Function id
# Query Returns:
#   The node id of the function MDG object
def function_is_promise(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]->(fn_obj:PDG_OBJECT)
                -[arg:PDG {{RelationType: "ARG"}}]->(promise_call:PDG_CALL)
                    <-[stmt_ref:REF {{RelationType: "obj"}}]-(promise_stmt)
                        // AST promise pattern
                        -[:AST {{RelationType: "init"}}]->({{Type: "NewExpression"}})
                            -[:AST {{RelationType: "callee"}}]->({{Type: "Identifier", IdentifierName: "Promise"}}),
            (promise_stmt)<-[path:CFG*1..]-()<-[def:FD]-(source)
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def function_is_promise_callback(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]->(fn_obj:PDG_OBJECT)
                -[arg:PDG {{RelationType: "ARG"}}]->(callback_ret:PDG_CALL)
                    <-[callback_ref:REF {{RelationType: "obj"}}]-(callback_stmt)
                        // AST callback pattern
                        -[:AST {{RelationType: "init"}}]->({{Type: "CallExpression"}})
                            -[:AST {{RelationType: "callee"}}]->({{Type: "MemberExpression"}})
                                -[:AST {{RelationType: "property"}}]->({{IdentifierName: "then"}}),
            (callback_stmt)<-[path:CFG*1..]-()<-[def:FD]-(source)
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        RETURN distinct source as node
    """


def function_is_function_callback(obj_id):
    return f"""
        MATCH
            (init {{Id: "{obj_id}"}})-[ref:REF {{RelationType: "obj"}}]->(fn_obj:PDG_OBJECT)
                -[arg_callback:PDG {{RelationType: "ARG"}}]->(callback_ret:PDG_CALL)
                    <-[callback_ref:REF {{RelationType: "obj"}}]-(callback_stmt)
                        // AST function callback pattern
                        -[:AST {{RelationType: "init"}}]->({{Type: "CallExpression"}})
                            -[:AST {{RelationType: "arg"}}]->(arg {{Type: "Identifier"}}),
            (callback_stmt)<-[path:CFG*1..]-()<-[def:FD]-(source)
        WHERE exists ( (source)-[:AST {{RelationType: "init"}}]->() )
        AND init.IdentifierName = arg.IdentifierName
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

def get_function_name(obj_id):
    return f"""
        MATCH
            ({{Id: "{obj_id}"}})-[:AST {{RelationType: "init"}}]->(fn_obj)
        WHERE fn_obj:FunctionExpression OR fn_obj:ArrowFunctionExpression
        RETURN distinct fn_obj.Location as location
    """


def extend_call_path(call_path_list: list[list[Call]], new_call: Call) -> list[list[Call]]:
    extended_call_path_list = []
    for call_path in call_path_list:
        call_path.append(new_call)
        extended_call_path_list.append(call_path)
    return extended_call_path_list


# This function checks if the function given as argument is exported (either
# directly, via new, or via a method).
def get_exported_type(session, function_id: int) -> Optional[list[Call]]:
    direct_function = session.run(check_if_function_is_directly_exported(function_id)).single()
    if direct_function is not None:
        return [{'type': 'Call',
                 'fn_name': direct_function["fn_node_id"],
                 'fn_id': function_id,
                 'source_fn_id': function_id}]

    property_function = session.run(check_if_function_is_property_exported_via_exports(function_id)).single()
    if property_function is None:
        property_function = session.run(check_if_function_is_property_exported_via_module(function_id)).single()
    if property_function is None:
        property_function = session.run(check_if_function_is_property_exported_via_module_prop(function_id)).single()
    if property_function is None:
        property_function = session.run(check_if_function_is_property_exported_via_prototype(function_id)).single()
    if property_function is None:
        property_function = session.run(check_if_function_is_property_exported_via_this_property(function_id)).single()
    if property_function is not None:
        if not property_function["is_function"]:
            return [
                {'type': 'Method',
                 'prop': property_function["prop_name"],
                 'fn_name': property_function["fn_node_id"],
                 'fn_id': function_id,
                 'source_fn_id': function_id}]
        else:
            return [
                {'type': 'New',
                 'prop': property_function["exp_prop_name"],
                 'fn_name': property_function["obj_name"],
                 'fn_id': property_function["source_obj_id"],
                 'source_fn_id': property_function["source_obj_id"]},
                {'type': 'Method',
                 'prop': property_function["prop_name"],
                 'fn_name': property_function["fn_node_id"],
                 'fn_id': function_id,
                 'source_fn_id': function_id}]

    return None

def get_top_level_function(session, function_id: int) -> Optional[list[Call]]:
    top_level_function = session.run(check_if_function_is_top_level(function_id)).single()
    if top_level_function is not None and top_level_function["is_top_level"]:
        return [{'type': 'TopLevel',
                 'fn_name': top_level_function["fn_name"],
                 'fn_id': function_id,
                 'source_fn_id': function_id}]
    return None


def get_return_type(returner, function_id: int) -> Optional[Call]:
    if returner["prop_name"] is None:
        return {'type': 'Call',
                'fn_name': returner["obj_name"],
                'fn_id': function_id,
                'source_fn_id': returner["source_obj_id"]}
    elif returner["prop_name"] is not None and returner["is_function"]:
        return {'type': 'New',
                'fn_name': returner["obj_name"],
                'fn_id': function_id,
                'source_fn_id': returner["source_obj_id"],
                'prop': returner["prop_name"]}
    elif returner["prop_name"] is not None:
        return {'type': 'Method',
                'fn_name': returner["obj_name"],
                'fn_id': function_id,
                'prop': returner["prop_name"],
                'source_fn_id': returner["source_obj_id"]}
    return None


# This function returns the functions that call a function given as argument
def find_callers(session, function_id: int) -> list[Call]:
    callers: list[Call] = []
    # promises = session.run(function_is_promise(function_id)).data()
    # Callbacks
    # promise_callbacks = session.run(function_is_promise_callback(function_id)).data()
    # fn_callbacks = session.run(function_is_function_callback(function_id)).data()
    # Direct call
    direct_calls = session.run(function_is_called(function_id)).data()
    # for caller in promises + promise_callbacks + fn_callbacks + direct_calls:
    for caller in direct_calls:
        callers.append(
            {'type': 'Call',
             'fn_id': int(caller["node"]["Id"]),
             'fn_name': caller["node"]["IdentifierName"]})
    return callers


# This function returns the functions that return a function given as argument
def find_returners(session, function_id: int) -> list[Call]:
    returners = session.run(function_is_returned(function_id))
    return [get_return_type(returner, function_id) for returner in returners]

def extract_port(match):
    return match.group(1) if match.group(1).isdigit() else match.group(2)

def check_server_type_vulnerability(fn_name: str) -> Optional[list[Call]]:
    with open(fn_name, "r") as fd:
        file_data = fd.read()

    if create_server_pattern.search(file_data):
        listen_match = listen_pattern.search(file_data)
        if listen_match:
            port = extract_port(listen_match)
            if port is not None:
                return [
                    {'type': 'ServerInitialization',
                    'port': int(port),
                    'fn_name': fn_name}
                    ]
    return None


# This function returns the call path from an exported function to the sink
def find_call_path(session, function_id: int, nodes: list[int], main_file: str, vulnerability_type: str) -> list[list[Call]]:
    # Avoid passing twice in the same function node
    if function_id in nodes:
        return []
    nodes.append(function_id)
    # Check if function is in the main file
    function_ast = session.run(get_function_name(function_id)).single()
    if function_ast is not None:
        fn_name = json.loads(function_ast["location"])["fname"]
        if main_file == fn_name:
            call_type: Optional[list[Call]] = None
            # Check if function <function_id> is a server initialization 
            if vulnerability_type == "path-traversal":
                call_type: Optional[list[Call]] = check_server_type_vulnerability(fn_name)
            
            if call_type is None:
                # Check if function <function_id> is exported
                call_type: Optional[list[Call]] = get_exported_type(session, function_id)
            
            if call_type is None:
                # Check if function <function_id> is top level function
                call_type: Optional[list[Call]] = get_top_level_function(session, function_id)
 
            # If function is exported, return the exported type
            if call_type is not None:
                return [call_type]

    call_paths: list[list[Call]] = []
    # Get functions that call the current function -> replace in call path
    callers: list[Call] = find_callers(session, function_id)
    for caller in callers:
        # Only process caller if it is not in the path (because of recursion)
        if caller["fn_id"] is not function_id:
            cur_call_paths = find_call_path(session, caller['fn_id'], nodes, main_file, vulnerability_type)
            call_paths += cur_call_paths

    # Get functions that return the current function -> extend call path
    returners: list[Call] = find_returners(session, function_id)
    for returner in returners:
        cur_call_paths = find_call_path(session, returner['source_fn_id'], nodes, main_file, vulnerability_type)
        cur_call_paths = extend_call_path(cur_call_paths, returner)
        call_paths += cur_call_paths
    return call_paths


# This functions returns a structure that maps the function names contained
# in all call paths to its arguments and types
def get_function_args(session, call_paths: list[list[Call]], detection_result: DetectionResult, config) -> dict[FunctionArgs]:
    function_map: dict[FunctionArgs] = {}
    for call_path in call_paths:
        for call in call_path:
            if call["type"] == "ServerInitialization":
                continue
            if call["fn_name"] not in function_map:
                tainted_params, params_types = reconstruct_param_types(session, call["fn_id"], detection_result, config)
                function_map[call["fn_name"]] = params_types
    return function_map


# This function generates the vulnerability info, which includes:
# 1. Source and source line number
# 2. Tainted Parameters
# 3. Parameters' Type
def get_vulnerability_info(session, detection_result: DetectionResult, source_file: str, config):
    # Get call path
    fn_node = session.run(get_parent_function(detection_result["sink_function"])).single()
    if not fn_node:
        print("Unable to detect sink function.")
        return

    call_paths: list[list[Call]] = find_call_path(session, fn_node["node"]["Id"], [], source_file, detection_result["vuln_type"])
    function_args: dict[FunctionArgs] = get_function_args(session, call_paths, detection_result, config)

    taint_summary = build_taint_summary(detection_result, call_paths, function_args, source_file)

    return taint_summary


def build_taint_summary(detection_result: DetectionResult, call_paths: list[list[Call]], function_args: dict[FunctionArgs], source_file: str):
    vulnerabilities = []

    for call_path in call_paths:
        current_call: TaintSummaryCall | None = None

        # We build the interaction protocol, starting from the most inner return (last call)
        if len(call_path) > 0:  # Has returns
            inner_return: TaintSummaryCall | None = None

            # Iterates from the second element to the last
            for depth, call in enumerate(call_path[::-1]):
                current_call: TaintSummaryCall = build_call(call, function_args, len(call_path) - depth - 1)

                # There is already a return
                if inner_return is not None:
                    current_call['returns'] = inner_return

                inner_return = current_call

        vulnerability_type: str = get_vulnerability_type(call_path)
        
        if vulnerability_type == "VServerInitialization":
            vulnerability = {
                'type': vulnerability_type,
                'filename': source_file,
                'vuln_type': detection_result["vuln_type"],
                'sink': detection_result["sink"],
                'sink_lineno': detection_result["sink_lineno"],
                'source': current_call["source"],
                'tainted_params': current_call["tainted_params"],
                'params_types': current_call["params_types"],
                "client" : {
                    "type": "GET",
                    "port": call_path[0]["port"]
                }
            }
        else: 
            vulnerability = {
                'type': vulnerability_type,
                'filename': source_file,
                'vuln_type': detection_result["vuln_type"],
                'sink': detection_result["sink"],
                'sink_lineno': detection_result["sink_lineno"],
                'source': current_call["source"],
                'tainted_params': current_call["tainted_params"],
                'params_types': current_call["params_types"]
            }
            if "returns" in current_call:
                vulnerability["returns"] = current_call["returns"]

        vulnerability["call_paths"] = call_path
        vulnerabilities.append(vulnerability)

    return vulnerabilities


def build_call(call: Call, function_args: dict[FunctionArgs], depth: int) -> TaintSummaryCall:
    source: str = "unknown"
    tainted_params = []
    param_types = {}

    if depth == 0 and call["type"] == "ServerInitialization":
        return {'source': "", 'params_types': {}, 'tainted_params': []}

    if depth == 0:
        if call["type"] == "Call" and call["fn_name"] is not None:  # Type is exported
            source = "module.exports"
        elif call["type"] == "Method":  # Type is property of exported object
            source = "module.exports." + call["prop"]
        elif call["type"] == "New" and call["prop"] is None:
            source = "new module.exports"
        elif call["type"] == "New" and call["prop"] is not None:
            source = "new module.exports." + call["prop"]
        elif call["type"] == "TopLevel":
            source = call["fn_name"]
    else:
        if call["type"] == "Call" and call["fn_name"] is not None:  # Type is exported
            source = ""
        elif call["type"] == "Method":  # Type is property of exported object
            source = "." + call["prop"]
        elif call["type"] == "New":
            source = "new"

    if call["fn_name"] is not None:
        param_types: FunctionArgs = function_args[call["fn_name"]]
        tainted_params: list[str] = list(param_types.keys())

    return {'source': source, 'params_types': param_types, 'tainted_params': tainted_params}


def get_vulnerability_type(call_path: list[Call]) -> str:
    if len(call_path) == 1:
        if call_path[0]["type"] == "Call":
            return "VFunExported"
        if call_path[0]["type"] == "Method":
            return "VFunPropOfExportedObj"
        if call_path[0]["type"] == "New":
            return "VNewCall"
        if call_path[0]["type"] == "ServerInitialization":
            return "VServerInitialization"
        if call_path[0]["type"] == "TopLevel":
            return "VTopLevel"

    if len(call_path) > 1:
        if call_path[0]["type"] == "New":
            return "VNewCall"
        if call_path[0]["type"] == "Call" or call_path[0]["type"] == "Method":
            return "VFunRetByExport"

    return "unknown"
