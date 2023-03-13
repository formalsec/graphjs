import fs = require("fs");

export interface SummaryDependency {
    obj: number
    deps: number[]
}

interface SummaryInput {
    function: string
    deps: SummaryDependency[]
}

export type Summaries = Map<string, SummaryDependency[]>

export function readSummaries(filePath: string): Summaries {
    const summaries: Summaries = new Map<string, SummaryDependency[]>();
    const summaryFileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    summaryFileContent.forEach((sum: SummaryInput) => {
        summaries.set(sum.function, sum.deps);
    })
    return summaries;
}
