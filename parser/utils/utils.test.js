/* eslint-disable no-undef */
const {
    copyObj,
    getNextNodeId,
    resetNodeId,
    resetVariableCount,
    getNextVariableName,
    getNextObjectName,
    resetObjectCount,
} = require("./utils");

test("create immutable copy of object", () => {
    const inputObj = {
        hello: "world",
    };

    expect(copyObj(inputObj)).toMatchObject(inputObj);
    expect(copyObj(inputObj)).not.toBe(inputObj);
});

test("reset node id", () => {
    getNextNodeId();
    expect(resetNodeId()).toBe(1);
});

test("get next node id", () => {
    resetNodeId();

    expect(getNextNodeId()).toBe(1);
    expect(getNextNodeId()).toBe(2);
    expect(getNextNodeId()).toBe(3);
    expect(getNextNodeId()).toBe(4);
});

test("reset variable count", () => {
    getNextVariableName();
    expect(resetVariableCount()).toBe(1);
});

test("get variable name", () => {
    resetVariableCount();

    expect(getNextVariableName()).toBe("v1");
    expect(getNextVariableName()).toBe("v2");
    expect(getNextVariableName()).toBe("v3");
    expect(getNextVariableName()).toBe("v4");
});

test("reset object count", () => {
    expect(resetObjectCount()).toBe(1);
});

test("get variable name", () => {
    resetObjectCount();

    expect(getNextObjectName()).toBe("o1");
    expect(getNextObjectName()).toBe("o2");
    expect(getNextObjectName()).toBe("o3");
    expect(getNextObjectName()).toBe("o4");
});
