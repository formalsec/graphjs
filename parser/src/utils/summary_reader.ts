import fs = require("fs");

export interface PackageOperation {
    type: string
    objs: number[]
}

export interface SummaryDependency {
    obj: number
    deps: number[]
}

// Interfaces to read the input
interface SummaryInput {
    function: string
    deps: SummaryDependency[]
}

interface PackageInput {
    name: string
    ops: PackageOperation[]
}

export type ArraySummaries = Map<string, SummaryDependency[]>
export type PackageSummaries = Map<string, PackageOperation[]>
export interface Summaries { "arrays": ArraySummaries, "auxiliary_functions": string[], "packages": PackageSummaries }

export function readSummaries(filePath: string): Summaries {
    const summaryFileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Read array summary
    const arraySummaries: ArraySummaries = new Map<string, SummaryDependency[]>();
    summaryFileContent.arrays?.forEach((sum: SummaryInput) => {
        arraySummaries.set(sum.function, sum.deps);
    })
    // Read auxiliary functions summary
    const auxFunctions: string[] = summaryFileContent.auxiliary_functions;

    // Read package summary
    const packageSummaries: PackageSummaries = new Map<string, PackageOperation[]>();
    summaryFileContent.packages?.forEach((sum: PackageInput) => {
        packageSummaries.set(sum.name, sum.ops);
    })
    return {
        arrays: arraySummaries,
        auxiliary_functions: auxFunctions,
        packages: packageSummaries
    };
}
