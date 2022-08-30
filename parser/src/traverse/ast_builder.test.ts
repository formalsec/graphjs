const { buildAST } = require("./ast_builder");
import esprima = require("esprima");
import { Graph } from "./graph/graph";

describe("Testing node class", () => {
    beforeEach(() => {

    });

    test("run empty code", () => {
        const code = "";
        const normalized = esprima.parseModule(code, { loc: true, tolerant: true});
        const graph = buildAST(normalized);
        expect(graph).toBeInstanceOf(Graph);
    });
});