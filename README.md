# Explode.js

## Run

Explode.js generates a graph using [npm](https://www.npmjs.com/)/[node](https://nodejs.org/en) and uses [Neo4j](https://neo4j.com/) to query the graph. <br>
This last component can be executed in a docker container (easier setup) or locally.
Both program versions are located in the [bin](./bin) folder.

By default, all the results are stored in a *explodejs-results* folder, in the root of the project, with the following structure:

```
explodejs-results
├── graph
│   ├── graph_stats.json (stores some metrics)
│   ├── nodes.csv (csv file of the graph nodes)
│   └── rels.csv (csv file of the graph relationships)
├── normalized.js (normalized code)
└── taint_summary.json (detection results)
```

### Requirements
- [npm](https://www.npmjs.com/) (I've tested v8.5.1, v9.5.1 and v9.4.0)
- [node](https://nodejs.org/en) (I've tested v18.16.1, v19.6.0)
- (**if locally**) [neo4j](https://neo4j.com/) (I've tested v5.9.0). Instructions: https://neo4j.com/docs/operations-manual/current/installation/linux/


### Run using docker
- Execute inside the *bin* folder
- If first time, execute the setup (`./setup.sh`)
- Have docker service running
- Create a config file (*/neo4j-custom/.config* ) with your password 
  - e.g. `password=<your-password>`

```bash
./explodejs-docker.sh -f <file_to_analyze> -s
```


### Run locally
- Execute inside the *bin* folder
- If first time, execute the setup (`./setup.sh`)
- Edit file [detection/run.py](detection/run.py) (line 27) with your neo4j credentials.
  - E.g. `auth=('neo4j', 'neo4jadmin')`
  - If it is your first time setting up neo4j, you might need to update the password (`neo4j-admin dbms set-initial-password <password>`)

```bash
./explodejs-local.sh -f <file_to_analyze> -s
```

Example:
`./explodejs-local.sh -f ../../explodejs-datasets/example-dataset/vulnerable/injection/example-0/example-0.js -s`


### Program options

| Description                                                	 |    Flag       	     |    Default      	    | Required 	 | Requires 	 |
|--------------------------------------------------------------|:-------------------:|:--------------------:|------------|------------|
| JavaScript file to be analyzed                             	 | -f <filename>     	 | -                  	 | Yes      	 | -        	 |
| Location of the configuration file                         	 | -c <filename>     	 | _'../config.json'_ 	 | No       	 | -        	 |
| Location of the normalized file                            	 | -o <filename>     	 | -                  	 | No       	 | -        	 |
| Location of the graph output directory (csv and svg files) 	 | -g <directory>    	 | _'src/graphs/'_    	 | No       	 | -        	 |
| Output the graph csv files                                 	 | --csv             	 | _false_            	 | No       	 | -        	 |
| Output the graph figure                                    	 | --graph           	 | _false_            	 | No       	 | -        	 |
| Set array of structures to ignore in graph figure          	 | --i=[AST, CFG...] 	 | _[]_               	 | No       	 | _graph_  	 |
| Set array of functions to ignore in graph figure           	 | --if=[...]        	 | _[]_               	 | No       	 | _graph_  	 |
| Show the code in each statement in graph figure            	 | --sc              	 | _false_            	 | No       	 | _graph_  	 |
| Silent mode (not verbose)                                  	 | --silent          	 | _false_            	 | No       	 | -        	 |


### Explode.js phases

#### 1. Build the code property graph (representation of source code)

This stage builds the code property graph of the program to be analyzed, a graph-based data structure that coalesces into the same representation the abstract syntax tree, control flow graph, and data dependency graph of the given program.

The code for the code property graph is in the [parser](./parser) folder.

This step outputs:
- Normalized javascript file of the program
- Graph outputs (svg and/or csv)
- Graph metrics (graph_stats.json)

#### 2. Query the graph

This stage queries the graphs to capture vulnerable code patterns, e.g. a data dependency paths connecting unreliable sources to dangerous sinks.

The code for the queries is in the [detection](./detection) folder.

This step uses the graph csv output and produces a summary file (*taint_summary.json*) with the detection results.