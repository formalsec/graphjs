JSFILE=$(realpath $1)

docker run --rm -v "$JSFILE:/js-cpg/input_file/index.js" -v "$(pwd)/tmp_out:/js-cpg/output_files" -t explodejs