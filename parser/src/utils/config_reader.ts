import fs = require("fs");

export interface Package {
    package: string,
    args: number[],
};

export interface FunctionSink {
    sink: string,
    args: number[],
};

export interface NewSink {
    sink: string,
    args: number[],
};

export interface PackageSink {
    sink: string,
    packages: Package[]
}

export type Sink = FunctionSink | NewSink | PackageSink;
export interface Config {
    functions: FunctionSink[],
    news: NewSink[],
    packages: PackageSink[],
};

export function read_config(filePath: string): Config {
    const fsinks: FunctionSink[] = [];
    const nsinks: NewSink[] = [];
	const psinks: PackageSink[] = [];

    let config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	if (config.sinks) {
        const vuln_types = config.sinks;
        Object.keys(vuln_types).forEach(vuln => {
            vuln_types[vuln].forEach((sink: any) => {
                const sname: string = sink.sink;
                const stype: string = sink.type;

                switch (stype) {
                    case "new": {
                        nsinks.push({
                            sink: sname,
                            args: sink.args,
                        });
                        break;
                    }
                    case "function": {
                        fsinks.push({
                            sink: sname,
                            args: sink.args,
                        });
                        break;
                    }
                    case "package": {
                        psinks.push({
                            sink: sname,
                            packages: sink.packages,
                        });
                        break;
                    }
                }
            });
        });
    }

    return {
        functions: fsinks,
        news: nsinks,
        packages: psinks
    };
}