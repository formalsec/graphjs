'use strict';

function deepMerge(result, initial, options = {}) {
  let nodes = [];
  let current = [initial];
  let levelCount = 0;
  let depth = typeof options.depth === 'number' ? options.depth : Infinity;
  while (current) {
    for (let key in current[0]) {
      if (current[0][key] && typeof current[0][key] === 'object' && options.deep !== false && depth > 0) {
        let parent;
        let isArray = Array.isArray(current[0][key]);
        if (current[1]) {
          current[1][key] = current[1][key] && typeof current[1][key] === 'object' ? current[1][key] : isArray ? [] : {};
          parent = current[1][key];
        } else {
          result[key] = result[key] && typeof result[key] === 'object' ? result[key] : isArray ? [] : {};
          parent = result[key];
        }
        levelCount++;
        nodes.push([current[0][key], parent]);
      } else {
        if (current[1]) current[1][key] = current[0][key];else result[key] = current[0][key];
      }
    }
    if (--levelCount === 0) depth--;
    current = nodes.shift();
  }
  return result;
}

module.exports = deepMerge;