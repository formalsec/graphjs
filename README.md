# Graph.js: A Static Vulnerability Scanner for _npm_ packages

Graph.js is a static vulnerability scanner specialized in analyzing _npm_
packages and detecting taint-style and prototype pollution vulnerabilities.

- Currently, detects 4 types of vulnerabilities:
    - _Path Traversal_ (CWE-22);
    - _Command Injection_ (CWE-94);
    - _Code Execution_ (CWE-78);
    - _Prototype Pollution_ (CWE-1321).
- Our evaluation on two curated datasets (VulcaN [1]; SecBench) shows that it significantly
  outperforms ODGen, the state-of-the-art tool, with lower false negatives and shorter analysis time.

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

---
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

## Tool Installation

Graph.js generates a graph using [npm](https://www.npmjs.com/)/[node](https://nodejs.org/en) and uses [Neo4j](https://neo4j.com/) to query the graph. <br>
This last component can be executed in a docker container (easier setup) or locally.

#### Requirements
- [Node](https://nodejs.org/en) (I've tested v18+).
- [Python3](https://www.python.org/downloads/).
- **Option 1 (Local queries)**: [Neo4j v5](https://neo4j.com/). Instructions: https://neo4j.com/docs/operations-manual/current/installation/linux/
- **Option 2 (Docker)**: [Docker](https://www.docker.com/). 
---

## Usage

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


#### Run 
- Execute inside the root folder
- If first time, execute the setup (`./setup.sh`)
- To run with docker:
  - Have docker service running
  - Use flag **-d**

```bash
python3 graphjs.py -f <file_to_analyze> -s [-d]
```

---

### Graph.js phases

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


### Generate only the graph

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
