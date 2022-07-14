class OutputManager {
    constructor(options, writer) {
        this._writer = writer;
        this._options = options;
    }

    set writer(writer) {
        this._writer = writer;
    }

    get writer() {
        return this._writer;
    }

    get options() {
        return this._options;
    }

    output(graph, filename) {
        this._writer.output(graph, this._options, filename);
    }
}

module.exports = {
    OutputManager,
};
