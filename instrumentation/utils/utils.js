const cartesian = require('cartesian');
const isObject = require('isobject');

function fillArrayUntilLength(array, defaultValue, targetLength) {
  if (typeof array === "string") {
    array = [];
  }

  const remainingLength = targetLength - array.length;
  if (remainingLength > 0) {
    const fillArray = Array(remainingLength).fill(defaultValue);
    return array.concat(fillArray);
  }
  return array;
}

function isStringObject(str) {
    if (typeof str === 'string') {
        str = str.replace(/'/g, '"');
        try {
            var obj = JSON.parse(str);
            return isObject(obj)
        } catch (error) {
            return false;
        }
    }
    return false;
}

const parseStringValue = (value) => {
    try {
        value = value.replace(/'/g, '"');
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
};

function splitStringIgnoringBraces(str) {
  var result = [];
  var openBraceCount = 0;
  var currentChunk = '';

  for (var i = 0; i < str.length; i++) {
    var char = str[i];

    if (char === '|' && openBraceCount === 0) {
      result.push(currentChunk.trim());
      currentChunk = '';
    } else {
      currentChunk += char;
      if (char === '{') {
        openBraceCount++;
      } else if (char === '}') {
        openBraceCount--;
      }
    }
  }

  if (currentChunk.trim() !== '') {
    result.push(currentChunk.trim());
  }

  return result;
}

const generateCartesianProduct = (data) => {
    if (Array.isArray(data)) {
        const cartesianProduct = data.map((value) => {
            return parseStringValue(value);
        });

        return cartesian(cartesianProduct);
    } else if (typeof data === 'object') {
        const cartesianProduct = {};

        for (const key in data) {
            const value = data[key];

            if (typeof value === 'string') {
                const convertedArray = splitStringIgnoringBraces(value).flatMap((val) => {
                    if (isStringObject(val)) {
                        return generateCartesianProduct(parseStringValue(val));
                    } else {
                        return parseStringValue(val);
                    }
                });
                cartesianProduct[key] = convertedArray;
            } else if (typeof value === 'object') {
                cartesianProduct[key] = generateCartesianProduct(value);
            } else {
                cartesianProduct[key] = value;
            }
        }

        const product = cartesian(Object.values(cartesianProduct));

        return product.map((p) => {
            return Object.fromEntries(Object.keys(cartesianProduct).map((key, index) => {
                return [key, p[index]];
            }));
        });
    } else if (typeof data === 'string') {
        try {
            const parsedObject = JSON.parse(data);
            return parsedObject;
        } catch (error) {
            return parseStringValue(data);
        }
    } else {
        return [];
    }
};

function indent(string, lvl = 1) {
    var indentation = (' ').repeat(4 * lvl);
    return string.split('\n').map((line) => indentation + line).join('\n');
}

module.exports = { generateCartesianProduct, fillArrayUntilLength, indent };
