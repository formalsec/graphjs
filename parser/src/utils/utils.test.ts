/* eslint-disable no-undef */
import { copyObj, getNextNodeId, resetNodeId, resetVariableCount, getNextVariableName, getNextLocationName, resetObjectCount } from "./utils";

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

    const x1 = getNextLocationName("x", 1);
    expect(x1).toBe("1.x-o1");

    const y1 = getNextLocationName("y", 1);
    expect(y1).toBe("1.y-o2");

    const w1 = getNextLocationName("w", 1);
    expect(w1).toBe("1.w-o3");

    const x2 = getNextLocationName("x", 1);
    expect(x2).toBe("1.x-o4");
});
