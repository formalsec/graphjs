const child_process_1 = require("child_process");
const DEFAULT_FILE = "output"

function plot(options) {
    /* Required Options */
    if (!options.data) throw new Error("The options object must have 'data' properties!");
    if (!options.style) options.style = "lines"; /* Default to lines */

    const cmd = getCmd(options)

    getFilePath(options, output = DEFAULT_FILE)

    let gnuplot;
    if (options.format)
        gnuplot = child_process_1.exec(`gnuplot | ${cmd} - ${options.filePath}`, {}, post_gnuplot_processing)
    else
        gnuplot = child_process_1.exec(`gnuplot > ${options.filePath}`, {}, post_gnuplot_processing)

    // setup_gnuplot(gnuplot, options);

    // ...

    //V2.2 --> passa a receber o filename

}

function getFilePath(options, output) {
    if (options.append && options.format === "pdf") {
        options.filePath = `${output}`
        // V2.1 -> `touch ${options.filePath}.${options.format}` and remove options.format === pdf
        // V3.1 -> options.filePath = `${options.outputDir}/${output}`
        child_process_1.exec(`touch ${options.filePath}.pdf`);
    }
    else {
        // V3.1 -> options.filePath = `${options.outputDir}/${output}-${Date.now()}`
        options.filePath = `${output}-${Date.now()}`
    }

    // V3.2 -->
}

function getCmd(options) {
    if (options.format === "pdf")
        return "ps2pdf"
    else if (options.format === "eps") {
        return "ps2eps"
    }
    return null
    /*
    V3.1
    if (!options.format) options.format = "ps"
    if (options.format.includes(pdf)) return `ps2${options.format}`
     */
}

/*
const options = {
    format: "pdf",
    append: false,
    finish: function () { console.log("End")}
}
plot(options)
*/