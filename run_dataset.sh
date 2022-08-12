#!/bin/bash

cd parser
example_files_vulnerable=( $(find ../datasets/example-dataset/vulnerable/* -type f  -name '*.js' ! -name "*normalized*" ! -name "*run-examples*" -not -path "*/aux-files/*") )
example_files_not_vulnerable=( $(find ../datasets/example-dataset/not-vulnerable/* -type f  -name '*.js' ! -name "*normalized*" ! -name "*run-examples*" -not -path "*/aux-files/*") )
example_files_odgen=( $(find ../datasets/injection-dataset/odgen-fn-examples/* -type f  -name '*.js' ! -name "*normalized*" ! -name "*run-examples*" -not -path "*/aux-files/*") )

for example in "${example_files_vulnerable[@]}" "${example_files_not_vulnerable[@]}" "${example_files_odgen[@]}"; do 
    result=$(npm start $example)
    if [[ $result =~ "Error: " ]]; then
        echo $example
    fi
done