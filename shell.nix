{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python313
    python313Packages.pip
    python313Packages.virtualenv
    neo4j
    nodejs_24
  ];

  shellHook = ''
    export NEO4J_HOME=$PWD/.neo4j
    mkdir -p $NEO4J_HOME/{data,logs,conf}
    if [ ! -f $NEO4J_HOME/conf/neo4j.conf ]; then
      cp -r ${pkgs.neo4j}/share/neo4j/conf/* $NEO4J_HOME/conf/
    fi
    echo "Neo4j home is set to $NEO4J_HOME"

    if [ ! -d .venv ]; then
      virtualenv .venv
    fi
    source .venv/bin/activate
  '';
}
