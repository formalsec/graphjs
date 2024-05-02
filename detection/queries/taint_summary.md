**Taint Summary Structure**:

- **Filename**: Name of the vulnerable file;

- **Vulnerability Type**: Type of vulnerability; 
  - Can be: *path-traversal*, 
  *code-execution*, *command-injection*, *prototype-pollution*.

- **Source**: Source function of the vulnerability; Can be:
  - *module.exports*: if it is the exported function
  - *module.exports.prop_name*: if it is a property of an exported object;

- **Source Line Number**: Line number of the source function.

- **Sink**: Type of synk call;
  - Can be *exec*, ...

- **Sink Line Number**: Line number of the sink call.

- **Tainted Parameters**: Parameters that are tainted (sources).

- **Parameters' Type**: Possible types for the parameters. Can be:
  - *string*;
  - *function*;
  - ...


