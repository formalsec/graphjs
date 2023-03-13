import fs = require("fs");
import { readSummaries, type Summaries } from "./summary_reader";

export interface Package {
    package: string
    args: number[]
}

export interface FunctionSink {
    sink: string
    args: number[]
}

export interface NewSink {
    sink: string
    args: number[]
}

export interface PackageSink {
    sink: string
    packages: Package[]
}

export type Sink = FunctionSink | NewSink | PackageSink;
export interface Config {
    functions: FunctionSink[]
    news: NewSink[]
    packages: PackageSink[]
    summaries: Summaries
}

export function readConfig(filePath: string): Config {
    const functionSinks: FunctionSink[] = [];
    const newSinks: NewSink[] = [];
    const packageSinks: PackageSink[] = [];

    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (config.sinks) {
        const vulnerabilityTypes = config.sinks;
        Object.keys(vulnerabilityTypes).forEach(vuln => {
            vulnerabilityTypes[vuln].forEach((sink: any) => {
                const sinkName: string = sink.sink;
                const sinkType: string = sink.type;

                switch (sinkType) {
                    case "new": {
                        newSinks.push({
                            sink: sinkName,
                            args: sink.args
                        });
                        break;
                    }
                    case "function": {
                        functionSinks.push({
                            sink: sinkName,
                            args: sink.args
                        });
                        break;
                    }
                    case "package": {
                        packageSinks.push({
                            sink: sinkName,
                            packages: sink.packages
                        });
                        break;
                    }
                }
            });
        });
    }

    const summaries = readSummaries("src/summaries.json");

    return {
        functions: functionSinks,
        news: newSinks,
        packages: packageSinks,
        summaries
    };
}
