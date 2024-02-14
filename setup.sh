#!/bin/bash

pip3 install detection/requirements.txt
cd parser && npm install

cd ../instrumentation2 && opam install .
