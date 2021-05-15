let VAR_COUNT = 0;
let NODE_COUNT = 0;

const copyObj = (obj) => {
    const new_obj = JSON.parse(JSON.stringify(obj));
    return new_obj;
};

const getNextNodeId = () => NODE_COUNT++;

const getNextVariableName = () => `v${VAR_COUNT++}`;
const resetVariableCount = () => VAR_COUNT = 0;

module.exports = {
    getNextVariableName,
    resetVariableCount,
    getNextNodeId,
    copyObj,
};

