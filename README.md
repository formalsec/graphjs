# Efficient Static Vulnerability Analysis for JavaScript with Multiversion Dependency Graphs

Mafalda Ferreira, Miguel Monteiro, Tiago Brito, Miguel E. Coimbra, Nuno Santos, Limin Jia, and José Fragoso
Santos. 2024. Efficient Static Vulnerability Analysis for JavaScript with Multiversion Dependency Graphs.
https://doi.org/XXXX


## Artifact evaluation
The [Artifact Evaluation](./artifact-evaluation) folder contains all the necessary instructions and scripts used to reproduce the results and the figures from the original paper.

[//]: [![DOI](https://zenodo.org/badge/724237294.svg)](https://zenodo.org/badge/latestdoi/724237294)

## Team

### Main Contributors
<table style="width: 80%; margin-left: auto; margin-right: auto;">
  <tr>
    <td style="text-align: center; width: 25%"><img src="https://raw.githubusercontent.com/formalsec/graphjs/main/assets/img/mafalda_ferreira.png" height="100px"/></td>
    <td style="text-align: center; width: 25%"><img src="https://raw.githubusercontent.com/formalsec/graphjs/main/assets/img/jose_fragoso_santos.png" height="100px"/></td>
    <td style="text-align: center; width: 25%"><img src="https://raw.githubusercontent.com/formalsec/graphjs/main/assets/img/filipe_marques.png" height="100px"/></td>
    <td style="text-align: center; width: 25%"><img src="https://raw.githubusercontent.com/formalsec/graphjs/main/assets/img/nuno_santos.jpeg" height="100px"/></td>
  </tr>
  <tr>
    <td style="text-align: center"><a href="https://www.dpss.inesc-id.pt/~mferreira/">Mafalda Ferreira</a></td>
    <td style="text-align: center"><a href="https://web.tecnico.ulisboa.pt/jose.fragoso/#projects">José Fragoso Santos</a></td>
    <td style="text-align: center"><a href="https://www.filipeom.dev/">Filipe Marques</a></td>
    <td style="text-align: center"><a href="https://syssec.dpss.inesc-id.pt/people/Nuno_Santos.html">Nuno Santos</a></td>
  </tr>
</table>

#### Collaborators
- [Tiago Brito](https://www.dpss.inesc-id.pt/blog/tiago-brito/)
- [Miguel Coimbra](https://www.dpss.inesc-id.pt/~mcoimbra/)
- [Limin Jia](https://www.andrew.cmu.edu/user/liminjia/)
- [Miguel Monteiro](https://www.linkedin.com/in/miguel-monteiro-229b86195/)

---

## Graph.js: A Static Vulnerability Scanner for _npm_ packages
Graph.js is a static vulnerability scanner specialized in analyzing _npm_
packages and detecting taint-style and prototype pollution vulnerabilities.

Its execution flow is composed of two phases: **graph construction**
and **graph queries**. In the first phase, Graph.js builds a
Multiversion Dependency Graph (MDG) of the program to be analyzed.
This graph-based data structure coalesces into the same
representation the abstract syntax tree, control flow graph, and
data dependency graph. This phase has two outputs:
1. Graph output: nodes and edges in .csv format.
2. Graph metrics: graph_stats.json

In the second phase, Graph.js imports the graph to a Neo4j graph
database, and executes graph queries, written in Cypher, to capture
vulnerable code patterns, e.g. data dependency paths connecting
unreliable sources to dangerous sinks.

- Currently, Graph.js detects four types of vulnerabilities: prototype
pollution (CWE-1321), OS command injection (CWE-78),
arbitrary code execution (CWE-94), and path traversal (CWE-22).

---


## Installation

Graph.js generates a graph using [Node](https://nodejs.org/en) and uses [Neo4j](https://neo4j.com/) to query the graph. <br>
It can be executed locally, or in a Docker container (easier and more robust setup).

### Using Docker
#### Requirements:
- [Python3](https://www.python.org/downloads/)
- [Docker](https://www.docker.com/)

Build the Docker container by running the command:
```
docker build -t graphjs .
```

### Run locally
#### Requirements:
- [Node](https://nodejs.org/en) (I've tested v18+).
- [Neo4j v5](https://neo4j.com/). Instructions: https://neo4j.com/docs/operations-manual/current/installation/linux/

Set up the local environment by running the command:
```
./setup.sh
```

---

## Usage

### Using Docker

Graph.js provides a command-line interface. Run it with **-h** for a short description.

```console
Usage: ./graphjs_docker.sh -f <file> [options]
Description: Run Graph.js for a given file <file> in a Docker container.

Required:
-f <file>    Filename (.js).

Options:
-o <path>    Path to store analysis results.
-l           Store docker logs.
-e           Create exploit template.
-s           Silent mode: Does not save graph .svg.
-h           Print this help.
```

To run Graph.js, run the command:
```bash
./graphjs_docker.sh -f <file_to_analyze> [options]
```

### Run locally

Graph.js provides a command-line interface. Run it with **-h** for a short description.

```console
Usage: graphjs.py [-h] -f FILE [-o OUTPUT] [-s] [-d] [-e]

Options:
  -h, --help            show this help message and exit
  -f FILE, --file FILE  Path to JavaScript file (.js) or directory containing JavaScript files for analysis.
  -o OUTPUT, --output OUTPUT
                        Path to store all output files.
  -s, --silent          Silent mode - no console and graph output.
  -d, --docker          Query mode - executes neo4j in a docker container instead of running locally.
  -e, --exploit         Generates symbolic tests.
```

To run Graph.js, run the command:
```bash
python3 graphjs.py -f <file_to_analyze> [options]
```

---
By default, all the results are stored in a *graphjs-results* folder, in the root of the project, with the following structure:

```
graphjs-results
├── graph
│   ├── graph_stats.json (stores some metrics)
│   ├── nodes.csv (csv file of the graph nodes)
│   ├── rels.csv (csv file of the graph relationships)
│   └── normalized.js (normalized code)
└── taint_summary_detection.json (detection results)
```

---

## Reusability 

Graph.js code is designed to enable  straightforward usage by others, and can be easily adapted to accommodate
new scenarios. As described before, Graph.js  is composed of two phases: graph construction and graph queries.
The graph construction code is located in the `graphjs/parser/src` folder, and the most relevant files are organized as follows:
```
src
├── parser.ts
├── output      # Code to generate outputs (.csv and .svg)
├── traverse    # Parsing algorithms
├── dependency
│   ├── structures/dependency_trackers.ts
│   └── dep_builder.ts
├── ast-builder.ts
├── cfg-builder.ts
└── cg-builder.ts
```
The code referring to the MDG construction algorithm is located
in `src/traverse/dependency, where the file `structures/dependency_trackers.ts` 
contains the rules and structures referred in the paper.
The MDG is intended to be generic, so all the building steps can be
adapted to new scenarios by creating new types of nodes and edges.

The code for the queries is in located in the `graphjs/detection`
folder. The queries are entirely customizable, so, it is possible not
only modify the existing queries but also to create new queries that
search for new and different patterns in the graph.


## Generate only the graph

- Execute inside the *parser* folder

```bash
npm start -- -f <file_to_be_analyzed> [options]
```

#### Program options

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

---


### Publications and Open-Source Repositories

The development of Graph.js relates to additional research performed by this group.

#### 1. Study of JavaScript Static Analysis Tools for Vulnerability Detection in Node.js Packages
This work comprises an empirical study of static code analysis tools for detecting vulnerabilities in Node.js code.
We created a curated dataset of 957 Node.js code vulnerabilities, characterized and annotated by analyzing the information contained in _npm_ advisory reports.

The dataset is available [here](https://github.com/VulcaN-Study/Supplementary-Material).

The publication associated with this work is:
- <a href="https://ieeexplore.ieee.org/document/10168679">**VulcaN Dataset [1]**</a>: Tiago Brito, Mafalda Ferreira, Miguel Monteiro, Pedro Lopes, Miguel Barros, José Fragoso Santos, Nuno Santos:
  *"Study of JavaScript Static Analysis Tools for Vulnerability Detection in Node.js Packages"*,
  in *IEEE Transactions on Reliability 2023 (ToR 2023)*.
```
@inproceedings{vulcan_tor,
  author = {Brito, Tiago and Ferreira, Mafalda and Monteiro, Miguel and Lopes, Pedro and Barros, Miguel and Santos, José Fragoso and Santos, Nuno},
  booktitle = {IEEE Transactions on Reliability},
  title = {Study of JavaScript Static Analysis Tools for Vulnerability Detection in Node.js Packages},
  year = {2023},
  pages = {1-16},
  doi = {10.1109/TR.2023.3286301},
}
```


#### 2. RuleKeeper: GDPR-Aware Personal Data Compliance for Web Frameworks
In this work we developed a prototype of RuleKeeper, a GDPR-aware policy compliance system for web frameworks.
RuleKeeper uses Graph.js to automatically check for the presence of GDPR compliance bugs in Node.js servers.

The prototype is available [here](https://github.com/rulekeeper/rulekeeper).

The publication associated with this work is:
- <a href="https://www.computer.org/csdl/proceedings-article/sp/2023/933600b014/1Js0DzhaXNm">**RuleKeeper**</a>:
  Mafalda Ferreira, Tiago Brito, José Fragoso Santos, Nuno Santos:
  *"RuleKeeper: GDPR-Aware Personal Data Compliance for Web Frameworks"*,
  in *Proceedings of 44th IEEE Symposium on Security and Privacy (S&P’23)*, 2023.
```
@inproceedings{ferreira_sp23,
  author = {Ferreira, Mafalda and Brito, Tiago and Santos, José Fragoso and Santos, Nuno},
  title = {RuleKeeper: GDPR-Aware Personal Data Compliance for Web Frameworks},
  booktitle = {Proceedings of 44th IEEE Symposium on Security and Privacy (S&P'23)},
  year = {2023},
  doi = {10.1109/SP46215.2023.00058},
  pages = {1014-1031},
  publisher = {IEEE Computer Society},
  address = {Los Alamitos, CA, USA},
}
```