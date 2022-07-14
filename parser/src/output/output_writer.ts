import { Graph } from "../traverse/graph/graph";

export abstract class OutputWriter {
    abstract output(graph: Graph, options: any, filename: string): void;
}
