import { type Graph } from "../traverse/graph/graph";
import { type OutputWriter } from "./output_writer";

export class OutputManager {
    private _writer: OutputWriter;
    private readonly _options: any;

    constructor(options: any, writer: OutputWriter) {
        this._writer = writer;
        this._options = options;
    }

    output(graph: Graph, filename: string): void {
        this._writer.output(graph, this._options, filename);
    }
}
