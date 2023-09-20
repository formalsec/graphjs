# Explode.js

## Run

Explode.js uses [Neo4j](https://neo4j.com/) to query the graph. <br>
This component can be executed locally (recommended for M1 Mac users) or in a docker container.
Both versions are located in the [bin](./bin) folder.

By default, all the results are stored in a *explodejs* folder, in the root of the project, with the following structure:

```
explodejs
├── graph
│   ├── graph_stats.json (stores some metrics)
│   ├── nodes.csv (csv file of the graph nodes)
│   └── rels.csv (csv file of the graph relationships)
├── normalized.js (normalized code)
└── taint_summary.json (detection results)
```

### Requirements
I am using node v18.16.1.

### Run locally
- Execute inside the *bin* folder

```bash
./explodejs-local.sh -f <file_to_analyze> -s
```

Example:
`./explodejs-local.sh -f ../../explodejs-datasets/example-dataset/vulnerable/injection/example-0/example-0.js -s`

### Run using docker
- Execute inside the *bin* folder
- Have docker service running
- Place password in the */neo4j-custom/.config* file (password="your-password")

```bash
./explodejs-docker.sh -f <file_to_analyze> -s
```

### Options

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

This stage builds the code property graph of the program to be analysed, a graph-based data structure that coalesces into the same representation
the abstract syntax tree, control flow graph, and data dependency graph of the given program.

The code for the code property graph is in the [parser](./parser) folder.

This step outputs:
- Normalized javascript file of the program
- Graph outputs (svg and/or csv)

#### 2. Query the graph

This stage queries the graphs to capture vulnerable code patterns, e.g. a data dependency paths connecting unreliable sources to dangerous sinks.

The code for the queries is in the [detection](./detection) folder.

This step outputs:
- Taint summary file - detection results