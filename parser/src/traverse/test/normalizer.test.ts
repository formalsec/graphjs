/* eslint-disable no-undef */
import esprima = require("esprima");
import fs = require("fs");
import escodegen from "escodegen";

import { resetVariableCount } from "../../utils/utils";
import {
    normalizeScript,
} from "../normalization/normalizer";

function testNormalization(testInputPath: string) {
    let testInputId = 1;
    let codePath = `${testInputPath}/input-code-${testInputId}.js`;
    let expectedCodePath = `${testInputPath}/input-expected-code-${testInputId}.js`;
    while(fs.existsSync(codePath) && fs.existsSync(expectedCodePath)) {
        const code = fs.readFileSync(codePath, "utf8");
        const expectedCode = fs.readFileSync(expectedCodePath, "utf8");

        const ast = esprima.parseScript(code);
        // get variables to be zero (this has to change,
        // maybe mockup this function so that variables
        // have predicatable names in future)
        resetVariableCount();
        const newAst = normalizeScript(ast);
        const newCode = escodegen.generate(newAst);
        // console.log(newCode);

        expect(newCode).toEqual(expectedCode);

        testInputId++;
        codePath = `${testInputPath}/input-code-${testInputId}.js`;
        expectedCodePath = `${testInputPath}/input-expected-code-${testInputId}.js`;
    }
}

test("testing normalize - check that normalization retains same behaviour (1) - binary expression", () => {
    testNormalization("./test-inputs/normalization/binary-expressions");
});

test("testing normalize - check that normalization retains same behaviour (2) - assignment", () => {
    testNormalization("./test-inputs/normalization/assignment-expressions");
});

test("testing normalize - check that normalization retains same behaviour (3) - conditionals", () => {
    testNormalization("./test-inputs/normalization/conditionals");
});

test("testing normalize - check that normalization retains same behaviour (4) - variable declarations", () => {
    testNormalization("./test-inputs/normalization/variable-declarations");
});

test("testing normalize - check that normalization retains same behaviour (5) - function declarations", () => {
    testNormalization("./test-inputs/normalization/function-declarations");
});

test("testing normalize - check that normalization retains same behaviour (6) - function expressions", () => {
    testNormalization("./test-inputs/normalization/function-expressions");
});

test("testing normalize - check that normalization retains same behaviour (7) - arrow function expressions", () => {
    testNormalization("./test-inputs/normalization/arrow-function-expressions");
});

test("testing normalize - check that normalization retains same behaviour (8) - if statements", () => {
    testNormalization("./test-inputs/normalization/if-statements");
});

test("testing normalize - check that normalization retains same behaviour (9) - unary expressions", () => {
    testNormalization("./test-inputs/normalization/unary-expressions");
});

test("testing normalize - check that normalization retains same behaviour (10) - object expressions", () => {
    testNormalization("./test-inputs/normalization/object-expressions");
});

test("testing normalize - check that normalization retains same behaviour (11) - member expressions", () => {
    testNormalization("./test-inputs/normalization/member-expressions");
});

test("testing normalize - check that normalization retains same behaviour (12) - call expressions", () => {
    testNormalization("./test-inputs/normalization/call-expressions");
});

test("testing normalize - check that normalization retains same behaviour (13) - new expressions", () => {
    testNormalization("./test-inputs/normalization/new-expressions");
});

test("testing normalize - check that normalization retains same behaviour (14) - do and dowhile statements", () => {
    testNormalization("./test-inputs/normalization/while-statements");
});

test("testing normalize - check that normalization retains same behaviour (15) - class expressions", () => {
    testNormalization("./test-inputs/normalization/class-expressions");
});

test("testing normalize - check that normalization retains same behaviour (16) - await expressions", () => {
    testNormalization("./test-inputs/normalization/await-expressions");
});

test("testing normalize - check that normalization retains same behaviour (17) - yield expressions", () => {
    testNormalization("./test-inputs/normalization/yield-expressions");
});

test("testing normalize - check that normalization retains same behaviour (18) - spread elements", () => {
    testNormalization("./test-inputs/normalization/spread-elements");
});

test("testing normalize - check that normalization retains same behaviour (19) - sequence expressions", () => {
    testNormalization("./test-inputs/normalization/sequence-expressions");
});

test("testing normalize - check that normalization retains same behaviour (20) - js-wala tests", () => {
    testNormalization("./test-inputs/normalization/js-wala");
});

test("testing normalize - check that normalization retains same behaviour (21) - array expressions", () => {
    testNormalization("./test-inputs/normalization/array-expressions");
});

test("testing normalize - check that normalization retains same behaviour (22) - logical expressions", () => {
    testNormalization("./test-inputs/normalization/logical-expressions");
});

test("testing normalize - check that normalization retains same behaviour (23) - labeled statements", () => {
    testNormalization("./test-inputs/normalization/labeled-statements");
});

test("testing normalize - check that normalization retains same behaviour (24) - literals", () => {
    testNormalization("./test-inputs/normalization/literals");
});

test("testing normalize - check that normalization retains same behaviour (25) - templates", () => {
    testNormalization("./test-inputs/normalization/template-expressions");
});

test("testing normalize - check that normalization retains same behaviour (26) - class declarations", () => {
    testNormalization("./test-inputs/normalization/class-declarations");
});

test("testing normalize - check that normalization retains same behaviour (26) - try statements and catch clause", () => {
    testNormalization("./test-inputs/normalization/try-statements");
});

test("testing normalize - check that normalization retains same behaviour (27) - for in/of statements", () => {
    testNormalization("./test-inputs/normalization/for-statements");
});

test("testing normalize - check that normalization retains same behaviour (28) - switch statements", () => {
    testNormalization("./test-inputs/normalization/switch-statements");
});