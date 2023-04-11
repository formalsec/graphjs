import fs = require("fs");

export interface SummaryDependency {
    obj: number
    deps: number[]
}

interface SummaryInput {
    function: string
    deps: SummaryDependency[]
}

export type ArraySummaries = Map<string, SummaryDependency[]>
export interface Summaries { "arrays": ArraySummaries, "auxiliary_functions": string[] }

export function readSummaries(filePath: string): Summaries {
    const summaries: ArraySummaries = new Map<string, SummaryDependency[]>();
    const summaryFileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    summaryFileContent.arrays?.forEach((sum: SummaryInput) => {
        summaries.set(sum.function, sum.deps);
    })
    const auxFunctions: string[] = summaryFileContent.auxiliary_functions;
    return {
        arrays: summaries,
        auxiliary_functions: auxFunctions
    };
}
