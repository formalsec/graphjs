const { copyObj, resetVariableCount, getNextVariableName } = require('./utils');

test('create immutable copy of object', () => {
    const input_obj = {
        hello: "world",
    };

    expect(copyObj(input_obj)).toMatchObject(input_obj);
    expect(copyObj(input_obj)).not.toBe(input_obj);
});

test('reset variable count', () => {
    expect(resetVariableCount()).toBe(1);
});

test('get variable name', () => {
    resetVariableCount();

    expect(getNextVariableName()).toBe('v1');
    expect(getNextVariableName()).toBe('v2');
    expect(getNextVariableName()).toBe('v3');
    expect(getNextVariableName()).toBe('v4');
});