const { copyObj, setVariableCount, getNextVariableName } = require('./utils');

test('create immutable copy of object', () => {
    const input_obj = {
        hello: "world",
    };

    expect(copyObj(input_obj)).toEqual(input_obj);
    expect(copyObj(input_obj)).not.toBe(input_obj);
});

test('set variable count', () => {
    expect(setVariableCount(0)).toBe(0);
    expect(setVariableCount(3)).toBe(3);
});

test('get variable name', () => {
    setVariableCount(0);

    expect(getNextVariableName()).toBe('v0');
    expect(getNextVariableName()).toBe('v1');
    expect(getNextVariableName()).toBe('v2');
    expect(getNextVariableName()).toBe('v3');
});