import buildAST from "../ast_builder";
import { Graph } from "../graph/graph";
import { normalizeScript } from "../normalization/normalizer";
import escodegen from "escodegen";
import esprima = require("esprima");

describe("Testing node class", () => {
    beforeEach(() => {

    });

    function runASTBuilder(code: string): Graph {
        let ast = esprima.parseModule(code, { loc: true, tolerant: true });
        const normalized = normalizeScript(ast);
        code = escodegen.generate(normalized);
        ast = esprima.parseModule(code, { loc: true, tolerant: true });
        return buildAST(ast, 0, 0, "");
    }

    function testMetrics(graph: any, numNodes: number, numEdges: number): void {
        const nodes = graph.nodes;
        const edges = graph.edges;
        expect(graph).toBeInstanceOf(Graph);
        expect(nodes.size).toBe(numNodes);
        expect(edges.size).toBe(numEdges);
        expect(graph.startNodes.get("AST")?.length).toBe(1);
        expect(nodes.get(0).type).toBe("Program");
    }

    test("Build AST for empty code", () => {
        const code = "";
        const graph = runASTBuilder(code);

        testMetrics(graph, 1, 0);
    });

    test("Build AST for literal", () => {
        const code = "0;";
        const graph = runASTBuilder(code);

        testMetrics(graph, 3, 2);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("ExpressionStatement");
        expect(nodes.get(2)?.type).toBe("Literal");
    });

    test("Build AST for identifier", () => {
        const code = "x;";
        const graph = runASTBuilder(code);

        testMetrics(graph, 3, 2);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("ExpressionStatement");
        expect(nodes.get(2)?.type).toBe("Identifier");
    });

    test("Build AST for variable declaration", () => {
        const code = "const x = 0;";
        const graph = runASTBuilder(code);

        testMetrics(graph, 3, 2);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("VariableDeclarator");
        expect(nodes.get(2)?.type).toBe("Literal");
    });

    test("Build AST for empty object declaration", () => {
        const code = "const o = {};";
        const graph = runASTBuilder(code);

        testMetrics(graph, 3, 2);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("VariableDeclarator");
        expect(nodes.get(2)?.type).toBe("ObjectExpression");
    });

    test("Build AST for non-empty object declaration", () => {
        const code = "const o = { x: 0 };";
        const graph = runASTBuilder(code);

        testMetrics(graph, 9, 8);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("VariableDeclarator");
        expect(nodes.get(2)?.type).toBe("ObjectExpression");
        expect(nodes.get(3)?.type).toBe("ExpressionStatement");
        expect(nodes.get(4)?.type).toBe("AssignmentExpression");
        expect(nodes.get(5)?.type).toBe("MemberExpression");
        expect(nodes.get(6)?.type).toBe("Identifier");
        expect(nodes.get(7)?.type).toBe("Identifier");
        expect(nodes.get(8)?.type).toBe("Literal");
    });

    test("Build AST for non-empty object declaration without normalization", () => {
        // const code = "const o = { x: 0 };";
        // const graph = runASTBuilder(code);

        // testMetrics(graph, 9, 8);
        // const nodes = graph.nodes;
        // expect(nodes.get(1)?.type).toBe("VariableDeclarator");
        // expect(nodes.get(2)?.type).toBe("ObjectExpression");
        // expect(nodes.get(3)?.type).toBe("ExpressionStatement");
        // expect(nodes.get(4)?.type).toBe("AssignmentExpression");
        // expect(nodes.get(5)?.type).toBe("MemberExpression");
        // expect(nodes.get(6)?.type).toBe("Identifier");
        // expect(nodes.get(7)?.type).toBe("Identifier");
        // expect(nodes.get(8)?.type).toBe("Literal");
    });

    test("Build AST for empty function declaration", () => {
        const code = "function f(){};";
        const graph = runASTBuilder(code);

        // should have Program Node, Identifier and Literal
        // should have two edges
        testMetrics(graph, 5, 4);
        const nodes = graph.nodes;
        expect(nodes.get(1)?.type).toBe("VariableDeclarator");
        expect(nodes.get(2)?.type).toBe("FunctionExpression");
        expect(nodes.get(3)?.type).toBe("BlockStatement");
        expect(nodes.get(4)?.type).toBe("EmptyStatement");
    });
});
