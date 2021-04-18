let VAR_COUNT = 0;
let NODE_COUNT = 0;

const copyObj = (obj) => JSON.parse(JSON.stringify(obj));

const getNextNodeId = () => NODE_COUNT++;

const getNextVariableName = () => `v${VAR_COUNT++}`;
const setVariableCount = (n) => VAR_COUNT = n;

module.exports = {
    getNextVariableName,
    setVariableCount,
    getNextNodeId,
    copyObj,
};

