/* eslint-disable no-plusplus */
let VAR_COUNT = 1;
let NODE_COUNT = 1;
let OBJ_COUNT = 1;

const copyObj = (obj) => {
    const newObj = JSON.parse(JSON.stringify(obj));
    return newObj;
};

const getNextNodeId = () => NODE_COUNT++;
// eslint-disable-next-line no-return-assign
const resetNodeId = () => NODE_COUNT = 1;

const getNextVariableName = () => `v${VAR_COUNT++}`;
// eslint-disable-next-line no-return-assign
const resetVariableCount = () => VAR_COUNT = 1;

const getNextObjectName = () => `o${OBJ_COUNT++}`;
// eslint-disable-next-line no-return-assign
const resetObjectCount = () => OBJ_COUNT = 1;

const printJSON = (json) => console.log(JSON.stringify(json, null, 2));

module.exports = {
    getNextVariableName,
    resetVariableCount,
    getNextNodeId,
    resetNodeId,
    copyObj,
    getNextObjectName,
    resetObjectCount,
    printJSON,
};
