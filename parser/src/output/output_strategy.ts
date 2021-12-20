import { Graph } from "../traverse/graph/graph";
import { OutputWriter } from "./output_writer";

export class OutputManager {
    private _writer: OutputWriter;
    private _options: any;

    constructor(options: any, writer: OutputWriter) {
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

    output(graph: Graph, filename: string) {
        this._writer.output(graph, this._options, filename);
    }
}
