import fs = require("fs");

export interface Package {
    package: string,
    args: number[],
};

export interface FunctionSink {
    sink: string,
    type: string,
    args: number[],
};

export interface PackageSink {
    sink: string,
    type: string,
    packages: Package[]
}

export type Sink = FunctionSink | PackageSink;

export function read_config(filePath: string): Sink[] {
    const fsinks: FunctionSink[] = [];
	const psinks: PackageSink[] = [];

    let config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	if (config.sinks) {
        const vuln_types = config.sinks;
        Object.keys(vuln_types).forEach(vuln => {
            vuln_types[vuln].forEach((sink: any) => {
                const sname: string = sink.sink;
                const stype: string = sink.type;

                if (sink.packages) {
                    psinks.push({
                        sink: sname,
                        type: stype,
                        packages: sink.packages,
                    });
                } else {
                    fsinks.push({
                        sink: sname,
                        type: stype,
                        args: sink.args,
                    });
                }
            });
        });
    }

    return [ ...fsinks, ...psinks];
}