let VAR_COUNT = 1;
let NODE_COUNT = 1;
let OBJ_COUNT = 1;

const copyObj = (obj) => {
    const new_obj = JSON.parse(JSON.stringify(obj));
    return new_obj;
};

const getNextNodeId = () => NODE_COUNT++;

const getNextVariableName = () => `v${VAR_COUNT++}`;
const resetVariableCount = () => VAR_COUNT = 1;

const getNextObjectName = () => `o${OBJ_COUNT++}`;
const resetObjectCount = () => OBJ_COUNT = 1;

module.exports = {
    getNextVariableName,
    resetVariableCount,
    getNextNodeId,
    copyObj,
    getNextObjectName,
    resetObjectCount,
};

